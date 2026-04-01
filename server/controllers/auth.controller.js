const authService = require('../services/auth.service');
const emailAuthService = require('../services/email-auth.service');
const { sendSuccess, sendFail } = require('../utils/response');
const { isValidEmail, isNonEmptyString } = require('../utils/validators');
const { RESPONSE_CODES } = require('../../shared/constants/response-codes');

async function sendEmailCode(req, res) {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    return sendFail(res, 400, '올바른 이메일 형식을 입력해주세요.', RESPONSE_CODES.INVALID_EMAIL);
  }

  try {
    await emailAuthService.sendEmailCode(email);
    return sendSuccess(res, '인증번호가 발송되었습니다.');
  } catch (error) {
    if (error.message === RESPONSE_CODES.DUPLICATE_EMAIL) {
      return sendFail(res, 409, '이미 사용 중인 이메일입니다.', RESPONSE_CODES.DUPLICATE_EMAIL);
    }

    console.error('[SEND EMAIL ERROR]', error);
    return sendFail(res, 500, '메일 발송에 실패했습니다.', 'MAIL_SEND_FAILED');
  }
}

async function verifyEmailCode(req, res) {
  const { email, code } = req.body;

  if (!isValidEmail(email) || !isNonEmptyString(code)) {
    return sendFail(res, 400, '이메일과 인증번호를 올바르게 입력해주세요.', RESPONSE_CODES.INVALID_INPUT);
  }

  try {
    await emailAuthService.verifyCode(email, code);
    return sendSuccess(res, '이메일 인증이 완료되었습니다.');
  } catch (error) {
    if (error.message === RESPONSE_CODES.AUTH_CODE_EXPIRED) {
      return sendFail(res, 400, '인증번호가 없거나 만료되었습니다. 다시 요청해주세요.', RESPONSE_CODES.AUTH_CODE_EXPIRED);
    }

    if (error.message === RESPONSE_CODES.INVALID_AUTH_CODE) {
      return sendFail(res, 400, '인증번호가 올바르지 않습니다.', RESPONSE_CODES.INVALID_AUTH_CODE);
    }

    return sendFail(res, 500, '인증 처리 중 오류가 발생했습니다.', 'VERIFY_FAILED');
  }
}

async function join(req, res, next) {
  const { email, pwd, nick } = req.body;

  if (!isValidEmail(email) || !isNonEmptyString(pwd) || !isNonEmptyString(nick)) {
    return sendFail(res, 400, '이메일, 비밀번호, 닉네임을 모두 입력해주세요.', RESPONSE_CODES.INVALID_INPUT);
  }

  try {
    await authService.join({ email, pwd, nick });
    emailAuthService.clearCode(email);

    return sendSuccess(res, '회원가입 완료!', {}, 201);
  } catch (error) {
    if (error.message === RESPONSE_CODES.EMAIL_NOT_VERIFIED) {
      return sendFail(res, 400, '이메일 인증을 먼저 완료해주세요.', RESPONSE_CODES.EMAIL_NOT_VERIFIED);
    }

    if (error.message === RESPONSE_CODES.DUPLICATE_EMAIL) {
      return sendFail(res, 409, '이미 사용 중인 이메일입니다.', RESPONSE_CODES.DUPLICATE_EMAIL);
    }

    if (error.message === RESPONSE_CODES.DUPLICATE_NICK) {
      return sendFail(res, 409, '이미 사용 중인 닉네임입니다.', RESPONSE_CODES.DUPLICATE_NICK);
    }

    return next(error);
  }
}

async function checkNick(req, res) {
  const { nick } = req.body;

  if (!isNonEmptyString(nick)) {
    return sendFail(res, 400, '닉네임을 입력해주세요.', 'INVALID_NICK');
  }

  try {
    await authService.checkNickAvailable(nick);
    return sendSuccess(res, '사용 가능한 닉네임입니다.');
  } catch (error) {
    if (error.message === RESPONSE_CODES.DUPLICATE_NICK) {
      return sendFail(res, 409, '이미 사용 중인 닉네임입니다.', RESPONSE_CODES.DUPLICATE_NICK);
    }

    return sendFail(res, 500, '서버 오류가 발생했습니다.', 'SERVER_ERROR');
  }
}

async function login(req, res, next) {
  const { email, pwd } = req.body;

  if (!isValidEmail(email) || !isNonEmptyString(pwd)) {
    return sendFail(
      res,
      400,
      '이메일과 비밀번호를 올바르게 입력해주세요.',
      RESPONSE_CODES.INVALID_INPUT
    );
  }

  try {
    const user = await authService.login({ email, pwd });

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          return next(saveErr);
        }

        return sendSuccess(res, `${user.nick}님 환영합니다!`, { user });
      });
    });
  } catch (error) {
    if (error.message === RESPONSE_CODES.LOGIN_FAILED) {
      return sendFail(
        res,
        401,
        '이메일 또는 비밀번호가 일치하지 않습니다.',
        RESPONSE_CODES.LOGIN_FAILED
      );
    }

    return next(error);
  }
}

function logout(req, res, next) {
  req.logout((logoutErr) => {
    if (logoutErr) {
      return next(logoutErr);
    }

    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        return next(sessionErr);
      }

      res.clearCookie('connect.sid');
      return sendSuccess(res, '로그아웃되었습니다.');
    });
  });
}

function getSession(req, res) {
  if (!req.user) {
    return sendFail(
      res,
      401,
      '로그인 정보가 없습니다. 다시 로그인 해주세요.',
      RESPONSE_CODES.UNAUTHORIZED || 'UNAUTHORIZED'
    );
  }

  return sendSuccess(res, '세션이 유효합니다.', { user: req.user });
}

function googleCallback(req, res, next) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (!req.user) {
    return res.redirect(`${clientUrl}/login`);
  }

  req.session.save((err) => {
    if (err) {
      return next(err);
    }

    return res.redirect(`${clientUrl}/dashboard`);
  });
}

module.exports = {
  sendEmailCode,
  verifyEmailCode,
  join,
  checkNick,
  login,
  logout,
  getSession,
  googleCallback,
};