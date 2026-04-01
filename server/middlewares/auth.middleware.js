const { sendFail } = require('../utils/response');
const { RESPONSE_CODES } = require('../../shared/constants/response-codes');


function isAuthenticated(req, res, next) {
  if (!req.session) {
    return sendFail(
  res,
  401,
  '세션이 만료되었습니다. 다시 로그인해주세요.',
  RESPONSE_CODES.SESSION_EXPIRED
);
  }

  if (!req.session.user) {
    return sendFail(res, 401, '로그인이 필요합니다.', RESPONSE_CODES.UNAUTHORIZED);
  }

  return next();
}

module.exports = {
  isAuthenticated,
};