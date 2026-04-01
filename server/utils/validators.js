const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  if (typeof email !== 'string') return false;

  const normalized = email.trim();
  return EMAIL_REGEX.test(normalized);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

module.exports = {
  isValidEmail,
  isNonEmptyString,
  isValidId,
};