const { sendFail } = require('../utils/response');
const { RESPONSE_CODES } = require('../../shared/constants/response-codes');

function isAuthenticated(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return sendFail(
      res,
      401,
      '로그인이 필요합니다.',
      RESPONSE_CODES.UNAUTHORIZED
    );
  }

  return next();
}

module.exports = {
  isAuthenticated,
};