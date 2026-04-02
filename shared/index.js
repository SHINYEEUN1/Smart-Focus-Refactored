const { POSTURE_STATUS, POSE_TYPE, GOOD_POSTURE_STATUS } = require('./constants/posture');
const { SOCKET_EVENTS } = require('./constants/socket-events');
const { RESPONSE_CODES } = require('./constants/response-codes');
const { AUTH_PROVIDERS } = require('./constants/auth-providers');
const { DEFAULT_ANALYSIS_RESULT, createAnalysisResult } = require('./schemas/analysis');
const { createSuccessResponse, createFailResponse } = require('./utils/response-shape');

module.exports = {
  POSTURE_STATUS,
  POSE_TYPE,
  GOOD_POSTURE_STATUS,
  SOCKET_EVENTS,
  RESPONSE_CODES,
  AUTH_PROVIDERS,
  DEFAULT_ANALYSIS_RESULT,
  createAnalysisResult,
  createSuccessResponse,
  createFailResponse,
};