// utils/analysis_engine.js
const {
  POSTURE_STATUS,
} = require('../../shared/constants/posture');
/**
 * [Smart Focus] 통합 분석 엔진
 * - 엎드림: h_offset >= 0.08 (WARNING), >= 0.03 (CAUTION)
 * - 거북목 : 측면(SIDE_LEFT/SIDE_RIGHT)에서만 판정, 귀-어깨 X축 거리 기준
 * - 핵심 랜드마크는 visibility > 0.7, 손/얼굴 보조 랜드마크는 상황별 완화 적용
 * - 턱 괴기: Face Mesh 152번(턱끝) 활용 + faceHeight 비율 기준
 */

// 1. 카메라 위치 및 모드 감지 (어깨 너비 기반)
const detect_camera_mode = (landmarks) => {
  if (!landmarks || landmarks.length < 13) return 'FRONT_VIEW';

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  const offset = Math.sqrt(
    Math.pow(leftShoulder.x - rightShoulder.x, 2) +
    Math.pow(leftShoulder.y - rightShoulder.y, 2)
  );

  if (offset < 0.15) {
    return leftShoulder.x > rightShoulder.x ? 'SIDE_RIGHT' : 'SIDE_LEFT';
  }

  return 'FRONT_VIEW';
};

// 2. 주변 소음 분석
const analyze_noise_level = (db) => {
  if (db >= 70) return 'NOISY';
  if (db >= 50) return 'NORMAL';
  return 'QUIET';
};

// 3. 사용자 이탈 체크 (주요 랜드마크 visibility > 0.7)
const check_user_presence = (landmarks) => {
  if (!landmarks || landmarks.length < 13) return false;

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  return (
    nose.visibility > 0.7 &&
    leftShoulder.visibility > 0.7 &&
    rightShoulder.visibility > 0.7
  );
};

/**
 * STATIC 상태 판정
 * staticState = {
 *   lastNosePos: { x, y } | null,
 *   staticCheckStart: number
 * }
 */
const check_static_posture = (nose, staticState) => {
  if (!staticState) {
    return null;
  }

  const now = Date.now();

  if (!staticState.lastNosePos) {
    staticState.lastNosePos = { x: nose.x, y: nose.y };
    staticState.staticCheckStart = now;
    return null;
  }

  const staticTime = now - staticState.staticCheckStart;
  const move = Math.sqrt(
    Math.pow(nose.x - staticState.lastNosePos.x, 2) +
    Math.pow(nose.y - staticState.lastNosePos.y, 2)
  );

  if (move >= 0.05) {
    staticState.lastNosePos = { x: nose.x, y: nose.y };
    staticState.staticCheckStart = now;
    return null;
  }

  if (staticTime >= 1800000) return POSTURE_STATUS.STATIC_WARNING;
  if (staticTime >= 1200000) return POSTURE_STATUS.STATIC_CAUTION;

  return null;
};

/**
 * 4. 세부 자세 분석
 * @param {Array}  landmarks
 * @param {String} mode
 * @param {Object} calibration
 * @param {Array}  faceLandmarks
 * @param {Object} staticState
 */
const analyze_posture = (
  landmarks,
  mode = 'FRONT_VIEW',
  calibration = null,
  faceLandmarks = null,
  staticState = null
) => {
  if (!landmarks || landmarks.length < 17) return POSTURE_STATUS.UNKNOWN;

  const currentMode = mode || 'FRONT_VIEW';

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftEar = landmarks[7];
  const rightEar = landmarks[8];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftPinky = landmarks[17];
  const rightPinky = landmarks[18];
  const leftIndex = landmarks[19];
  const rightIndex = landmarks[20];

  // [0] 부동 자세 판정
  const staticPosture = check_static_posture(nose, staticState);
  if (staticPosture) {
    return staticPosture;
  }

  // 핵심 랜드마크 visibility 체크
  if (leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5) {
    if (nose.visibility < 0.3) return POSTURE_STATUS.SLUMPED_WARNING;
  }

  if (
    nose.visibility < 0.1 ||
    leftShoulder.visibility < 0.1 ||
    rightShoulder.visibility < 0.1
  ) {
    return POSTURE_STATUS.UNKNOWN;
  }

  const shoulderYAvg = (leftShoulder.y + rightShoulder.y) / 2;
  const hOffset = nose.y - shoulderYAvg;
  const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);

  // [1] 턱 괴기 판정
  const handVisible =
    leftWrist.visibility > 0.1 ||
    rightWrist.visibility > 0.1 ||
    leftIndex.visibility > 0.1 ||
    rightIndex.visibility > 0.1;

  if (handVisible) {
    let chinPoint;

    if (faceLandmarks && faceLandmarks[152]) {
      chinPoint = {
        x: faceLandmarks[152].x,
        y: faceLandmarks[152].y,
      };
    } else {
      chinPoint = {
        x: (landmarks[9].x + landmarks[10].x) / 2,
        y: (landmarks[9].y + landmarks[10].y) / 2,
      };
    }

    const faceHeight = Math.abs(nose.y - chinPoint.y);

    if (faceHeight > 0.001) {
      const distL = Math.min(
        Math.sqrt(Math.pow(leftWrist.x - chinPoint.x, 2) + Math.pow(leftWrist.y - chinPoint.y, 2)),
        Math.sqrt(Math.pow(leftPinky.x - chinPoint.x, 2) + Math.pow(leftPinky.y - chinPoint.y, 2)),
        Math.sqrt(Math.pow(leftIndex.x - chinPoint.x, 2) + Math.pow(leftIndex.y - chinPoint.y, 2))
      );

      const distR = Math.min(
        Math.sqrt(Math.pow(rightWrist.x - chinPoint.x, 2) + Math.pow(rightWrist.y - chinPoint.y, 2)),
        Math.sqrt(Math.pow(rightPinky.x - chinPoint.x, 2) + Math.pow(rightPinky.y - chinPoint.y, 2)),
        Math.sqrt(Math.pow(rightIndex.x - chinPoint.x, 2) + Math.pow(rightIndex.y - chinPoint.y, 2))
      );

      const ratio = Math.min(distL, distR) / faceHeight;
      const finalThreshold = faceLandmarks ? 0.45 : 0.7;

      if (ratio < finalThreshold) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`턱 괴기 감지 (비율: ${ratio.toFixed(2)}, Mesh: ${!!faceLandmarks})`);
        }
        return POSTURE_STATUS.LEANING_ON_HAND;
      }
    }
  }

  // [2] 기울어짐 판정
  if (shoulderSlope >= 0.07) return POSTURE_STATUS.TILTED_WARNING;
  if (shoulderSlope >= 0.03) return POSTURE_STATUS.TILTED_CAUTION;

  // [3] 엎드림 판정
  if (hOffset >= 0.08) return POSTURE_STATUS.SLUMPED_WARNING;

  if (currentMode === 'FRONT_VIEW' && calibration && calibration.noseY) {
    const diffY = (nose.y - calibration.noseY) * 480;

    if (diffY >= 50) return POSTURE_STATUS.SLUMPED_WARNING;
    if (diffY >= 20) return POSTURE_STATUS.SLUMPED_CAUTION;
  }

  if (hOffset >= 0.03) return POSTURE_STATUS.SLUMPED_CAUTION;

  // [4] 거북목 판정
  if (currentMode.startsWith('SIDE')) {
    const ear = currentMode === 'SIDE_LEFT' ? leftEar : rightEar;
    const shoulder = currentMode === 'SIDE_LEFT' ? leftShoulder : rightShoulder;

    if (ear.visibility > 0.7 && calibration && calibration.sideDistX) {
      const currentDistX = Math.abs(ear.x - shoulder.x) * 640;
      const diffX = calibration.sideDistX - currentDistX;
      const diffY = (ear.y - (shoulder.y - 0.15)) * 480;

      let allowTolerance = 0;
      if (diffY > 10) allowTolerance = diffY * 0.5;

      const dynamicThreshold = 25 + allowTolerance;

      if (diffX >= dynamicThreshold + 20) return POSTURE_STATUS.TURTLE_NECK_WARNING;
      if (diffX >= dynamicThreshold) return POSTURE_STATUS.TURTLE_NECK_CAUTION;
    }
  }

  return POSTURE_STATUS.GOOD_POSTURE;
};

/**
 * 5. 맞춤형 코칭 메시지 생성
 */
const get_coaching_message = (postureStatus, noiseStatus) => {
  const messages = {
  [POSTURE_STATUS.SLUMPED_WARNING]: "고개를 너무 깊게 숙이고 있어요! 허리를 쭉 펴볼까요?",
  [POSTURE_STATUS.SLUMPED_CAUTION]: "자세가 조금 낮아졌네요. 고개를 들어주세요.",
  [POSTURE_STATUS.LEANING_ON_HAND]: "턱을 괴면 척추와 얼굴 대칭에 좋지 않아요.",
  [POSTURE_STATUS.TURTLE_NECK_WARNING]: "목이 앞으로 많이 나왔어요! 목에 약 27kg의 부담이 가고 있어요. 어깨를 펴고 고개를 들어주세요.",
  [POSTURE_STATUS.TURTLE_NECK_CAUTION]: "거북목 주의! 목에 약 18kg의 부담이 가고 있어요. 조금 더 바른 자세를 유지해보세요",
  [POSTURE_STATUS.TILTED_WARNING]: "몸이 한쪽으로 심하게 기울어져 있습니다. 수평을 맞춰보세요.",
  [POSTURE_STATUS.TILTED_CAUTION]: "어깨가 약간 기울어져 있네요.",
  [POSTURE_STATUS.STATIC_WARNING]: "30분간 움직임이 없어요! 잠시 일어나 가볍게 스트레칭 해보세요.",
  [POSTURE_STATUS.STATIC_CAUTION]: "한 자세로 너무 오래 있었어요. 몸을 조금 움직여볼까요?",
  [POSTURE_STATUS.GOOD_POSTURE]: "집중하기 딱 좋은 자세입니다!",
};

  if (postureStatus !== POSTURE_STATUS.GOOD_POSTURE && messages[postureStatus]) {
    return messages[postureStatus];
  }

  if (postureStatus === POSTURE_STATUS.GOOD_POSTURE && noiseStatus === 'NOISY') {
    return '주변이 조금 시끄럽네요. 이어폰 착용을 추천드려요.';
  }

  return messages.GOOD_POSTURE;
};

module.exports = {
  detect_camera_mode,
  analyze_noise_level,
  check_user_presence,
  analyze_posture,
  get_coaching_message,
};