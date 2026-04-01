const pool = require('../config/database');
const bcrypt = require('bcrypt');
const emailAuthService = require('./email-auth.service');

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
    [normalizedEmail, hashedPassword, trimmedNick, 'local']
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

  const [users] = await pool.query(
    `SELECT
      user_idx, email, pwd, nick, provider, sns_id, created_at
      FROM users
      WHERE email = ? AND (provider = 'local' OR provider IS NULL)
    `,
    [normalizedEmail]
  );

  if (users.length === 0) {
    throw new Error(AUTH_ERROR.LOGIN_FAILED);
  }

  const user = users[0];
  const isMatch = await bcrypt.compare(pwd, user.pwd);

  if (!isMatch) {
    throw new Error(AUTH_ERROR.LOGIN_FAILED);
  }

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

async function findGoogleUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  const [rows] = await pool.query(
    `SELECT
      user_idx, email, nick, provider, sns_id, created_at
      FROM users
      WHERE email = ? AND provider = 'google'
    `,
    [normalizedEmail]
  );

  return rows[0] || null;
}

async function createGoogleUser({ email, nick, snsId }) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedNick = nick.trim();

  const [result] = await pool.query(
    `
      INSERT INTO users (email, nick, provider, sns_id, created_at)
      VALUES (?, ?, 'google', ?, CURRENT_TIMESTAMP)
    `,
    [normalizedEmail, trimmedNick, snsId]
  );

  return findUserById(result.insertId);
}

module.exports = {
  join,
  checkNickAvailable,
  login,
  findUserById,
  findGoogleUserByEmail,
  createGoogleUser,
  AUTH_ERROR,
};