const immersionService = require('../services/immersion.service');
const { sendSuccess, sendFail } = require('../utils/response');
const { RESPONSE_CODES } = require('../../shared/constants/response-codes');

async function startSession(req, res, next) {
  try {
    const userIdx = req.session?.user?.user_idx;

    if (!userIdx) {
      return sendFail(res, 401, '로그인이 필요합니다.', RESPONSE_CODES.UNAUTHORIZED);
    }

    const immIdx = await immersionService.startSession(userIdx);

    return sendSuccess(res, '집중 세션이 시작되었습니다.', { imm_idx: immIdx }, 201);
  } catch (error) {
    return next(error);
  }
}

async function logData(req, res, next) {
  try {
    const { imm_idx: immIdx, noise, pose } = req.body;

    if (!immIdx) {
      return sendFail(res, 400, 'imm_idx가 필요합니다.', RESPONSE_CODES.INVALID_IMMERSION_ID);
    }

    if (!noise && !pose) {
      return sendFail(res, 400, '저장할 로그 데이터가 없습니다.', RESPONSE_CODES.EMPTY_LOG_DATA);
    }

    await immersionService.logSessionData({
      immIdx,
      noise,
      pose,
    });

    return sendSuccess(res, '로그 데이터가 저장되었습니다.');
  } catch (error) {
    return next(error);
  }
}

async function endSession(req, res, next) {
  try {
    const { imm_idx: immIdx, imm_score: immScore } = req.body;
    const userIdx = req.session?.user?.user_idx;

    if (!immIdx) {
      return sendFail(res, 400, 'imm_idx가 필요합니다.', RESPONSE_CODES.INVALID_IMMERSION_ID);
    }

    if (!userIdx) {
      return sendFail(res, 401, '로그인이 필요합니다.', RESPONSE_CODES.UNAUTHORIZED);
    }

    const result = await immersionService.endSession({
      immIdx,
      userIdx,
      immScore,
    });

    return sendSuccess(res, '집중 세션이 종료되었습니다.', result);
  } catch (error) {
    return next(error);
  }
}

async function getReport(req, res, next) {
  try {
    const { imm_idx: immIdx } = req.params;
    const userIdx = req.session?.user?.user_idx;

    if (!immIdx) {
      return sendFail(res, 400, 'imm_idx가 필요합니다.', RESPONSE_CODES.INVALID_IMMERSION_ID);
    }

    if (!userIdx) {
      return sendFail(res, 401, '로그인이 필요합니다.', RESPONSE_CODES.UNAUTHORIZED);
    }

    const reportData = await immersionService.getReport({
      immIdx,
      userIdx,
    });

    if (!reportData) {
      return sendFail(res, 404, '리포트를 찾을 수 없습니다.', RESPONSE_CODES.REPORT_NOT_FOUND);
    }

    return sendSuccess(res, '리포트 조회 성공', reportData);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  startSession,
  logData,
  endSession,
  getReport,
};