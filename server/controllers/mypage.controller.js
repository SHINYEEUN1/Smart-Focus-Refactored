const mypageService = require('../services/mypage.service');
const { sendSuccess, sendFail } = require('../utils/response');
const { RESPONSE_CODES } = require('../../shared/constants/response-codes');

function isOwner(userIdxFromParams, user) {
  return Number(userIdxFromParams) === Number(user?.user_idx);
}

async function getStats(req, res, next) {
  const { user_idx: userIdx } = req.params;

  if (!isOwner(userIdx, req.user)) {
    return sendFail(res, 403, '권한이 없습니다.', RESPONSE_CODES.FORBIDDEN);
  }

  try {
    const stats = await mypageService.getStats(userIdx);
    return sendSuccess(res, '마이페이지 통계 조회 성공', stats);
  } catch (error) {
    return next(error);
  }
}

async function getHistory(req, res, next) {
  const { user_idx: userIdx } = req.params;

  if (!isOwner(userIdx, req.user)) {
    return sendFail(res, 403, '권한이 없습니다.', RESPONSE_CODES.FORBIDDEN);
  }

  try {
    const history = await mypageService.getHistory(userIdx);
    return sendSuccess(res, '집중 히스토리 조회 성공', history);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getStats,
  getHistory,
};