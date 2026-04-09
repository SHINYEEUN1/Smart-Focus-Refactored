const pool = require('../config/database');
const bcrypt = require('bcrypt');
const emailAuthService = require('./email-auth.service');
const { AUTH_PROVIDERS } = require('../../shared');

// bcrypt 해시 강도. 값이 높을수록 보안이 강하지만 CPU 사용량이 증가한다.
// 10은 보안과 성능의 일반적인 균형점이다.
const SALT_ROUNDS = 10;

const AUTH_ERROR = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_NICK: 'DUPLICATE_NICK',
  LOGIN_FAILED: 'LOGIN_FAILED',
};

async function join({ email, pwd, nick }) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedNick = nick.trim();

  // 이메일 인증이 완료된 경우에만 가입을 허용한다.
  // 인증되지 않은 이메일로 가입하면 본인 확인이 불가능해 계정 도용 위험이 생긴다.
  if (!emailAuthService.isVerified(normalizedEmail)) {
    throw new Error(AUTH_ERROR.EMAIL_NOT_VERIFIED);
  }

  const [existingUsers] = await pool.query(
    'SELECT user_idx FROM users WHERE email = ?',
    [normalizedEmail]
  );

  if (existingUsers.length > 0) {
    throw new Error(AUTH_ERROR.DUPLICATE_EMAIL);
  }

  const [existingNicks] = await pool.query(
    'SELECT user_idx FROM users WHERE nick = ?',
    [trimmedNick]
  );

  if (existingNicks.length > 0) {
    throw new Error(AUTH_ERROR.DUPLICATE_NICK);
  }

  const hashedPassword = await bcrypt.hash(pwd, SALT_ROUNDS);

  await pool.query(
    'INSERT INTO users (email, pwd, nick, provider, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [normalizedEmail, hashedPassword, trimmedNick, AUTH_PROVIDERS.LOCAL]
  );
}

async function checkNickAvailable(nick) {
  const trimmedNick = nick.trim();

  const [rows] = await pool.query(
    'SELECT user_idx FROM users WHERE nick = ?',
    [trimmedNick]
  );

  if (rows.length > 0) {
    throw new Error(AUTH_ERROR.DUPLICATE_NICK);
  }
}

async function login({ email, pwd }) {
  const normalizedEmail = email.trim().toLowerCase();

  // provider가 LOCAL이거나 NULL인 계정만 일반 로그인 허용.
  // 소셜 로그인 계정은 비밀번호가 더미값으로 설정되어 있어
  // 일반 로그인 경로로 접근하면 보안 문제가 생길 수 있다.
  const [users] = await pool.query(
    `SELECT
      user_idx, email, pwd, nick, provider, sns_id, created_at
      FROM users
      WHERE email = ? AND (provider = ? OR provider IS NULL)
    `,
    [normalizedEmail, AUTH_PROVIDERS.LOCAL]
  );

  if (users.length === 0) {
    throw new Error(AUTH_ERROR.LOGIN_FAILED);
  }

  const user = users[0];
  const isMatch = await bcrypt.compare(pwd, user.pwd);

  if (!isMatch) {
    throw new Error(AUTH_ERROR.LOGIN_FAILED);
  }

  // 비밀번호 해시를 세션 및 응답에 포함시키지 않기 위해 제거한다.
  const { pwd: _password, ...userInfo } = user;
  return userInfo;
}

async function findUserById(userId) {
  if (!userId) {
    return null;
  }

  const [rows] = await pool.query(
    'SELECT user_idx, email, nick, provider, sns_id, created_at FROM users WHERE user_idx = ?',
    [userId]
  );

  return rows[0] || null;
}

// SNS ID 우선 조회 후, 없으면 이메일로 재조회한다.
// 이유: 동일 이메일로 여러 소셜 계정이 존재할 수 있으므로 sns_id 매칭을 먼저 시도하고,
// sns_id가 없는 경우(이메일만 있는 계정)는 이메일로 연결한다.
async function findOAuthUser({ provider, snsId, email }) {
  if (provider && snsId) {
    const [snsRows] = await pool.query(
      `SELECT user_idx, email, nick, provider, sns_id, created_at
       FROM users
       WHERE provider = ? AND sns_id = ?`,
      [provider, String(snsId)]
    );

    if (snsRows[0]) {
      return snsRows[0];
    }
  }

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();

    const [emailRows] = await pool.query(
      `SELECT user_idx, email, nick, provider, sns_id, created_at
       FROM users
       WHERE email = ?`,
      [normalizedEmail]
    );

    if (emailRows[0]) {
      return emailRows[0];
    }
  }

  return null;
}

// 소셜 로그인 신규 사용자 생성.
// 비밀번호 필드가 NOT NULL이므로 더미 비밀번호를 bcrypt로 해시하여 저장한다.
// 더미 비밀번호는 provider+snsId+timestamp 조합이므로 추측 불가하며,
// 소셜 사용자는 이 경로로 로그인하지 않으므로 보안상 문제가 없다.
async function createOAuthUser({ provider, email, nick, snsId }) {
  const normalizedEmail = email ? email.trim().toLowerCase() : null;
  const trimmedNick = nick?.trim() || `${provider}_user`;

  const dummyPassword = await bcrypt.hash(
    `${provider}_${snsId}_${Date.now()}`,
    SALT_ROUNDS
  );

  const [result] = await pool.query(
    `
      INSERT INTO users (email, pwd, nick, provider, sns_id, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [normalizedEmail, dummyPassword, trimmedNick, provider, String(snsId)]
  );

  return findUserById(result.insertId);
}

// 소셜 로그인 시 기존 계정이 있으면 반환하고, 없으면 신규 생성한다.
// 재가입 방지 및 동일 사용자의 계정 통합 처리를 위한 함수다.
async function findOrCreateOAuthUser({ provider, email, nick, snsId }) {
  let user = await findOAuthUser({ provider, snsId, email });

  if (!user) {
    user = await createOAuthUser({ provider, email, nick, snsId });
  }

  return user;
}

module.exports = {
  join,
  checkNickAvailable,
  login,
  findUserById,
  findOAuthUser,
  createOAuthUser,
  findOrCreateOAuthUser,
  AUTH_ERROR,
};
