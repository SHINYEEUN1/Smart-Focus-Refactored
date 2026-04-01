const { RESPONSE_CODES } = require('../../shared/constants/response-codes');

function sendSuccess(
  res,
  message,
  data = {},
  status = 200,
  code = RESPONSE_CODES.SUCCESS
) {
  return res.status(status).json({
  success: true,
  message,
  code,
  data,
});
}

function sendFail(
  res,
  status,
  message,
  code = RESPONSE_CODES.REQUEST_FAILED
) {
  return res.status(status).json({
    success: false,
    message,
    code,
    error,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  sendSuccess,
  sendFail,
};