const DEFAULT_ANALYSIS_RESULT = {
  status: 'SUCCESS',
  camera_mode: 'UNKNOWN',
  noise_status: 'UNKNOWN',
  posture_status: 'GOOD_POSTURE',
  current_score: 100,
  message: '',
  timestamp: null,
};

function createAnalysisResult(overrides = {}) {
  return {
    ...DEFAULT_ANALYSIS_RESULT,
    ...overrides,
  };
}

module.exports = {
  DEFAULT_ANALYSIS_RESULT,
  createAnalysisResult,
};