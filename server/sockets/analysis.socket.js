const {
  validateStreamData,
  analyzeStreamFrame,
  getBufferedFinalPosture,
  buildAnalysisResponse,
} = require('../services/analysis.service');

const { SOCKET_EVENTS } = require('../../shared/constants/socket-events');

const { savePoseIfChanged } = require('../services/pose.service');
const { saveNoiseIfNeeded } = require('../services/noise.service');
const { SOCKET_INTERVALS } = require('../utils/mappers');

function createInitialSocketState() {
  return {
    lastSavedPostureStatus: null,
    postureBuffer: [],
    lastDispatchAtMs: 0,
    lastNoiseSavedAtMs: 0,
    isProcessing: false,
    staticState: {
      lastNosePos: null,
      staticCheckStart: Date.now(),
    },
  };
}

function registerAnalysisSocket(io) {
  io.on('connection', (socket) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('클라이언트 연결됨:', socket.id);
    }

    const socketState = createInitialSocketState();

    socket.emit(SOCKET_EVENTS.ENGINE_READY, {
      status: 'READY',
      message: 'AI 분석 엔진 가동 시작',
    });

    socket.on(SOCKET_EVENTS.STREAM_DATA, async (streamData) => {
      // 현재는 중복 처리 방지를 위해 처리 중 들어온 프레임은 스킵
      if (socketState.isProcessing) {
        return;
      }

      socketState.isProcessing = true;

      try {
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

        const analysisResult = analyzeStreamFrame(streamData, socketState);

        if (!analysisResult.isUserDetected) {
          socket.emit(SOCKET_EVENTS.ANALYSIS_RESULT, analysisResult.error);
          return;
        }

        const { currentPosture, cameraMode, noiseStatus } = analysisResult;

        socketState.postureBuffer.push(currentPosture);

        const currentTimestampMs = Date.now();
        const elapsedMs = currentTimestampMs - socketState.lastDispatchAtMs;

        if (elapsedMs < SOCKET_INTERVALS.ANALYSIS_DISPATCH_MS) {
          return;
        }

        if (socketState.postureBuffer.length === 0) {
          return;
        }

        const finalPosture = getBufferedFinalPosture(socketState.postureBuffer);

        socketState.postureBuffer.length = 0;
        socketState.lastDispatchAtMs = currentTimestampMs;

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

        const responsePayload = buildAnalysisResponse({
          cameraMode,
          noiseStatus,
          finalPosture,
        });

        socket.emit(SOCKET_EVENTS.ANALYSIS_RESULT, responsePayload);
      } catch (error) {
        console.error('[STREAM PROCESS ERROR]', error);
        socket.emit(SOCKET_EVENTS.ANALYSIS_RESULT, {
          status: 'ERROR',
          message: '스트림 데이터 처리 중 오류가 발생했습니다.',
        });
      } finally {
        socketState.isProcessing = false;
      }
    });

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