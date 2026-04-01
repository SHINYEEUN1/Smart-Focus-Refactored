function createSuccessResponse({
  message = '',
  data = {},
  code = 'SUCCESS',
}) {
  return {
    success: true,
    message,
    code,
    data,
    timestamp: new Date().toISOString(),
  };
}

function createFailResponse({
  message = '',
  code = 'REQUEST_FAILED',
  error = null,
}) {
  return {
    success: false,
    message,
    code,
    error,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  createSuccessResponse,
  createFailResponse,
};