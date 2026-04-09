// 실시간 분석에 필요한 서비스 및 설정 모듈 import
// analysis.service: 스트림 데이터 검증, 자세 분석, 결과 생성
// SOCKET_EVENTS: 클라이언트와 통신할 이벤트 이름 정의
// GOOD_POSTURE_STATUS: 좋은 자세 판별 기준
// pose/noise.service: DB 저장 로직
// SOCKET_INTERVALS: 분석 및 저장 주기 설정

const {
  validateStreamData,
  analyzeStreamFrame,
  getBufferedFinalPosture,
  buildAnalysisResponse,
} = require('../services/analysis.service');

const { SOCKET_EVENTS } = require('../../shared/constants/socket-events');
const { GOOD_POSTURE_STATUS } = require('../../shared/constants/posture');
const { savePoseIfChanged } = require('../services/pose.service');
const { saveNoiseIfNeeded } = require('../services/noise.service');
const { SOCKET_INTERVALS } = require('../utils/mappers');

// 소켓 연결 시 사용자별 상태를 초기화하는 함수.
// 각 클라이언트마다 독립된 상태 객체를 가져야 하므로,
// 모듈 수준의 공유 상태 대신 연결 시점에 새로 생성한다.
function createInitialSocketState() {
  return {
    // 마지막으로 DB에 저장된 자세 상태.
    // 동일 자세가 반복될 때 불필요한 INSERT를 막기 위해 이전 값과 비교한다.
    lastSavedPostureStatus: null,

    // 프레임 단위로 쌓이는 자세 데이터 버퍼.
    // 순간적인 오탐(노이즈)을 제거하고 일정 시간 동안의 다수결로 최종 자세를 판단하기 위해 사용한다.
    postureBuffer: [],

    // 마지막으로 분석 결과를 클라이언트에 전송한 시점(ms).
    // 너무 자주 emit하면 네트워크 부하가 생기므로 ANALYSIS_DISPATCH_MS 간격을 강제한다.
    lastDispatchAtMs: 0,

    // 마지막으로 소음 데이터를 DB에 저장한 시점(ms).
    // 소음은 매 프레임마다 저장할 필요 없으므로 NOISE_SAVE_MS 간격으로 throttle한다.
    lastNoiseSavedAtMs: 0,

    // 중복 처리 방지 플래그.
    // 이전 프레임의 비동기 처리가 완료되기 전에 새 프레임이 도착하면 건너뛴다.
    // 이유: DB 저장 등 비동기 작업이 쌓이면 서버 메모리와 DB 커넥션이 고갈될 수 있다.
    isProcessing: false,

    // 실시간 집중 점수 (누적 방식, 0~100).
    // 좋은 자세이면 +1, 나쁜 자세이면 -3으로 갱신하며 분석 결과와 함께 클라이언트에 전송한다.
    currentScore: 100,

    // 정적 자세 감지를 위한 상태 저장.
    // 코나 어깨가 일정 시간 이상 거의 움직이지 않으면 STATIC 경고를 발생시킨다.
    staticState: {
      lastNosePos: null,
      staticCheckStart: Date.now(),
    },
  };
}

// 클라이언트가 소켓 연결을 시작하면 실행되는 영역.
// 사용자별 실시간 분석 세션을 시작하고 각종 이벤트 리스너를 등록한다.
function registerAnalysisSocket(io) {
  io.on('connection', (socket) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('클라이언트 연결됨:', socket.id);
    }

    // 해당 클라이언트 전용 상태 객체 생성.
    // 여러 클라이언트가 동시에 연결되어도 상태가 섞이지 않도록 독립적으로 생성한다.
    const socketState = createInitialSocketState();

    // 클라이언트에게 분석 엔진 준비 완료 신호 전송.
    // 클라이언트는 이 이벤트를 받은 후 스트림 데이터 전송을 시작한다.
    socket.emit(SOCKET_EVENTS.ENGINE_READY, {
      status: 'READY',
      message: 'AI 분석 엔진 가동 시작',
    });

    // 클라이언트에서 실시간으로 보내는 데이터 처리 (카메라 자세, 소음 등).
    socket.on(SOCKET_EVENTS.STREAM_DATA, async (streamData) => {
      // 이전 프레임 처리 중이면 새 데이터는 무시한다.
      // 이유: Promise 체인이 쌓이면 메모리 누수와 DB 커넥션 고갈이 발생할 수 있다.
      if (socketState.isProcessing) {
        return;
      }

      socketState.isProcessing = true;

      try {
        // 클라이언트에서 받은 데이터 유효성 검사.
        // 잘못된 데이터(landmarks 누락 등)는 분석하지 않고 조기에 반환한다.
        const validationResult = validateStreamData(streamData);

        if (!validationResult.isValid) {
          socket.emit(SOCKET_EVENTS.ANALYSIS_RESULT, {
            status: 'INVALID_INPUT',
            message: validationResult.message,
          });
          return;
        }

        const {
          noise_db: noiseLevelDb,
          imm_idx: immersionId,
        } = streamData;

        if (!immersionId && process.env.NODE_ENV !== 'production') {
          console.warn('[STREAM WARNING] immersionId 없이 분석 결과만 처리 중');
        }

        // 현재 프레임을 기반으로 자세 및 상태 분석 수행.
        const analysisResult = analyzeStreamFrame(streamData, socketState);

        // 사용자가 감지되지 않으면 분석 중단 (카메라 밖, 얼굴 미인식 등).
        if (!analysisResult.isUserDetected) {
          socket.emit(SOCKET_EVENTS.ANALYSIS_RESULT, analysisResult.error);
          return;
        }

        const { currentPosture, cameraMode, noiseStatus } = analysisResult;

        // 프레임 단위 자세를 버퍼에 저장한다.
        // 일정 시간 동안 모아서 다수결로 최종 자세를 판단하기 위함이다.
        socketState.postureBuffer.push(currentPosture);

        const currentTimestampMs = Date.now();
        const elapsedMs = currentTimestampMs - socketState.lastDispatchAtMs;

        // 너무 자주 분석 결과를 보내지 않도록 제한한다.
        // 일정 시간 간격으로만 처리하여 클라이언트 렌더링 부하를 줄인다.
        if (elapsedMs < SOCKET_INTERVALS.ANALYSIS_DISPATCH_MS) {
          return;
        }

        if (socketState.postureBuffer.length === 0) {
          return;
        }

        // 버퍼에 쌓인 데이터를 기반으로 최종 자세 결정.
        // 노이즈 제거 및 안정화 목적으로 다수결 방식을 사용한다.
        const finalPosture = getBufferedFinalPosture(socketState.postureBuffer);

        // 실시간 집중 점수 계산 (누적 방식).
        // 좋은 자세면 +1, 나쁜 자세면 -3으로 조정한다.
        // 나쁜 자세에 더 큰 패널티를 주는 이유: 자세 이탈을 즉각 인지시켜 교정을 유도하기 위함.
        // Math.min / Math.max로 점수 범위를 0~100으로 제한한다.
        if (GOOD_POSTURE_STATUS.includes(finalPosture)) {
          socketState.currentScore = Math.min(100, socketState.currentScore + 1);
        } else {
          socketState.currentScore = Math.max(0, socketState.currentScore - 3);
        }

        // 다음 분석 주기를 위해 버퍼를 비운다.
        // .length = 0은 배열 참조를 유지하면서 내용만 초기화하는 방식이다.
        // 새 배열을 할당하면 참조가 바뀌어 다른 코드에서의 참조가 깨질 수 있다.
        socketState.postureBuffer.length = 0;
        socketState.lastDispatchAtMs = currentTimestampMs;

        // 자세와 소음 데이터를 DB에 저장 (병렬 처리).
        // Promise.allSettled를 사용하는 이유: 하나가 실패해도 나머지가 중단되지 않도록 하기 위함.
        // 소음 저장 실패가 자세 저장까지 막아선 안 된다.
        const [poseResult, noiseResult] = await Promise.allSettled([
          savePoseIfChanged({
            immersionId,
            finalPosture,
            lastSavedPostureStatus: socketState.lastSavedPostureStatus,
          }),
          saveNoiseIfNeeded({
            immersionId,
            noiseLevelDb,
            currentTimestampMs,
            lastNoiseSavedAtMs: socketState.lastNoiseSavedAtMs,
            noiseSaveIntervalMs: SOCKET_INTERVALS.NOISE_SAVE_MS,
          }),
        ]);

        // 저장 성공 시 다음 비교를 위해 상태를 업데이트한다.
        // 실패 시 상태를 갱신하지 않으면 다음 프레임에서 재시도가 이루어진다.
        if (poseResult.status === 'fulfilled') {
          socketState.lastSavedPostureStatus = poseResult.value.nextSavedStatus;
        } else {
          console.error('[POSE SAVE ERROR]', poseResult.reason);
        }

        if (noiseResult.status === 'fulfilled') {
          socketState.lastNoiseSavedAtMs = noiseResult.value.nextNoiseSavedAtMs;
        } else {
          console.error('[NOISE SAVE ERROR]', noiseResult.reason);
        }

        // 분석 결과를 클라이언트로 보낼 형태로 변환 후 전송.
        // 점수, 자세, 소음 상태를 포함한다.
        const responsePayload = buildAnalysisResponse({
          cameraMode,
          noiseStatus,
          finalPosture,
          currentScore: socketState.currentScore,
        });

        socket.emit(SOCKET_EVENTS.ANALYSIS_RESULT, responsePayload);

      } catch (error) {
        console.error('[STREAM PROCESS ERROR]', error);
        socket.emit(SOCKET_EVENTS.ANALYSIS_RESULT, {
          status: 'ERROR',
          message: '스트림 데이터 처리 중 오류가 발생했습니다.',
        });
      } finally {
        // 처리 완료 후 반드시 플래그를 해제해야 다음 프레임이 처리될 수 있다.
        // try/catch 어디서 반환되더라도 finally는 항상 실행되므로 플래그 해제 위치로 적합하다.
        socketState.isProcessing = false;
      }
    });

    // 클라이언트 연결 종료 시 메모리를 정리한다.
    // 버퍼와 정적 상태를 초기화하여 GC가 해당 메모리를 회수할 수 있도록 한다.
    socket.on('disconnect', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('클라이언트 연결 종료:', socket.id);
      }

      socketState.postureBuffer.length = 0;
      socketState.staticState.lastNosePos = null;
      socketState.staticState.staticCheckStart = Date.now();
    });
  });
}

module.exports = registerAnalysisSocket;
