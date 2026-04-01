const nodemailer = require('nodemailer');
const pool = require('../config/database');

const AUTH_CODE_EXPIRE_MS = 3 * 60 * 1000;

const EMAIL_AUTH_ERROR = {
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  AUTH_CODE_EXPIRED: 'AUTH_CODE_EXPIRED',
  INVALID_AUTH_CODE: 'INVALID_AUTH_CODE',
};

const tempAuthCodes = Object.create(null);
const authCodeTimers = Object.create(null);

if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
  console.warn('[MAIL CONFIG WARNING] MAIL_USER 또는 MAIL_PASS가 설정되지 않았습니다.');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function generateAuthCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function removeExpiredAuthCode(email) {
  const authInfo = tempAuthCodes[email];

  if (!authInfo) return;

  if (authInfo.expiry <= Date.now()) {
    delete tempAuthCodes[email];
  }
}

function scheduleAuthCodeCleanup(email) {
  if (authCodeTimers[email]) {
    clearTimeout(authCodeTimers[email]);
  }

  authCodeTimers[email] = setTimeout(() => {
    removeExpiredAuthCode(email);
    delete authCodeTimers[email];
  }, AUTH_CODE_EXPIRE_MS + 1000);
}

async function sendEmailCode(email) {
  const normalizedEmail = normalizeEmail(email);
  const authCode = generateAuthCode();

  const [existingUsers] = await pool.query(
    'SELECT id FROM users WHERE email = ?',
    [normalizedEmail]
  );

  if (existingUsers.length > 0) {
    throw new Error(EMAIL_AUTH_ERROR.DUPLICATE_EMAIL);
  }

  await transporter.sendMail({
    from: `"smart-focus" <${process.env.MAIL_USER}>`,
    to: normalizedEmail,
    subject: '[smart-focus] 회원가입 인증번호입니다.',
    text: `인증번호는 [${authCode}] 입니다. 3분 이내에 입력해주세요.`,
  });

  tempAuthCodes[normalizedEmail] = {
    code: authCode,
    isVerified: false,
    verifiedAt: null,
    expiry: Date.now() + AUTH_CODE_EXPIRE_MS,
  };

  scheduleAuthCodeCleanup(normalizedEmail);
}

function verifyCode(email, code) {
  const normalizedEmail = normalizeEmail(email);
  removeExpiredAuthCode(normalizedEmail);

  const authInfo = tempAuthCodes[normalizedEmail];

  if (!authInfo) {
    throw new Error(EMAIL_AUTH_ERROR.AUTH_CODE_EXPIRED);
  }

  if (authInfo.code !== String(code).trim()) {
    throw new Error(EMAIL_AUTH_ERROR.INVALID_AUTH_CODE);
  }

  authInfo.isVerified = true;
  authInfo.verifiedAt = Date.now();
}

function isVerified(email) {
  const normalizedEmail = normalizeEmail(email);
  removeExpiredAuthCode(normalizedEmail);

  const authInfo = tempAuthCodes[normalizedEmail];
  return !!authInfo?.isVerified;
}

function clearCode(email) {
  const normalizedEmail = normalizeEmail(email);

  if (authCodeTimers[normalizedEmail]) {
    clearTimeout(authCodeTimers[normalizedEmail]);
    delete authCodeTimers[normalizedEmail];
  }

  delete tempAuthCodes[normalizedEmail];
}

module.exports = {
  sendEmailCode,
  verifyCode,
  isVerified,
  clearCode,
  EMAIL_AUTH_ERROR,
};