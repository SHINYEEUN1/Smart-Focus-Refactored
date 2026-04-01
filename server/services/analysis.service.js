// services/analysis.service.js
const {
  detect_camera_mode,
  analyze_noise_level,
  check_user_presence,
  analyze_posture,
  get_coaching_message,
} = require('../utils/analysis_engine');

const { getDisplayScore } = require('../utils/mappers');
const { POSTURE_STATUS } = require('../../shared/constants/posture');

function validateStreamData(streamData) {
  if (!streamData || typeof streamData !== 'object') {
    return {
      isValid: false,
      message: 'stream_data 형식이 올바르지 않습니다.',
    };
  }

  const { landmarks, noise_db: noiseLevelDb } = streamData;

  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return {
      isValid: false,
      message: 'landmarks 데이터가 올바르지 않습니다.',
    };
  }

  if (noiseLevelDb !== undefined && typeof noiseLevelDb !== 'number') {
    return {
      isValid: false,
      message: 'noise_db 값이 올바르지 않습니다.',
    };
  }

  return {
    isValid: true,
    message: 'OK',
  };
}

function analyzeStreamFrame(streamData, socketState) {
  const {
    landmarks,
    noise_db: noiseLevelDb,
    calibration,
    faceLandmarks,
  } = streamData;

  if (!check_user_presence(landmarks)) {
    return {
      isUserDetected: false,
      cameraMode: null,
      noiseStatus: null,
      currentPosture: null,
      error: {
        status: 'USER_NOT_FOUND',
        message: '사용자를 찾는 중입니다...',
      },
    };
  }

  const cameraMode = detect_camera_mode(landmarks);
  const noiseStatus = analyze_noise_level(noiseLevelDb);
  const currentPosture = analyze_posture(
    landmarks,
    cameraMode,
    calibration,
    faceLandmarks,
    socketState.staticState
  );

  return {
    isUserDetected: true,
    cameraMode,
    noiseStatus,
    currentPosture,
    error: null,
  };
}

function getBufferedFinalPosture(postureBuffer) {
  if (!Array.isArray(postureBuffer) || postureBuffer.length === 0) {
    return POSTURE_STATUS.GOOD_POSTURE;
  }

  const postureCounts = {};

  for (const posture of postureBuffer) {
    postureCounts[posture] = (postureCounts[posture] || 0) + 1;
  }

  let finalPosture = 'GOOD_POSTURE';
  let maxCount = 0;

  for (const [posture, count] of Object.entries(postureCounts)) {
    if (count > maxCount) {
      maxCount = count;
      finalPosture = posture;
    }
  }

  return finalPosture;
}

function buildAnalysisResponse({ cameraMode, noiseStatus, finalPosture }) {
  const coachingMessage = get_coaching_message(finalPosture, noiseStatus);
  const currentScore = getDisplayScore(finalPosture);

  return {
    status: 'SUCCESS',
    camera_mode: cameraMode,
    noise_status: noiseStatus,
    posture_status: finalPosture,
    current_score: currentScore,
    message: coachingMessage,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  validateStreamData,
  analyzeStreamFrame,
  getBufferedFinalPosture,
  buildAnalysisResponse,
};