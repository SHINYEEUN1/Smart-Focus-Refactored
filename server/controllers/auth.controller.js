const crypto = require('crypto');

const authService = require('../services/auth.service');
const emailAuthService = require('../services/email-auth.service');
const { sendSuccess, sendFail } = require('../utils/response');
const { isValidEmail, isNonEmptyString } = require('../utils/validators');
const { RESPONSE_CODES, AUTH_PROVIDERS } = require('../../shared');

function getClientUrl() {
  return process.env.CLIENT_URL || 'http://localhost:5173';
}

function redirectToLogin(res) {
  return res.redirect(`${getClientUrl()}/login`);
}

function redirectToDashboard(res) {
  return res.redirect(`${getClientUrl()}/dashboard`);
}

function finishOAuthLogin(req, res, next, user) {
  req.login(user, (loginErr) => {
    if (loginErr) {
      return next(loginErr);
    }

    req.session.save((saveErr) => {
      if (saveErr) {
        return next(saveErr);
      }

      return redirectToDashboard(res);
    });
  });
}

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
    return sendFail(res, 400, '닉네임을 입력해주세요.', RESPONSE_CODES.INVALID_NICK);
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
      RESPONSE_CODES.UNAUTHORIZED
    );
  }

  return sendSuccess(res, '세션이 유효합니다.', { user: req.user });
}

function googleCallback(req, res, next) {
  if (!req.user) {
    return redirectToLogin(res);
  }

  req.session.save((err) => {
    if (err) {
      return next(err);
    }

    return redirectToDashboard(res);
  });
}

function redirectKakao(req, res) {
  const redirectUri = encodeURIComponent(process.env.KAKAO_CALLBACK_URL);
  const clientId = process.env.KAKAO_CLIENT_ID;

  const url =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code`;

  return res.redirect(url);
}

async function kakaoCallback(req, res, next) {
  const { code } = req.query;

  if (!code) {
    return redirectToLogin(res);
  }

  try {
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID,
        client_secret: process.env.KAKAO_CLIENT_SECRET || '',
        redirect_uri: process.env.KAKAO_CALLBACK_URL,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[KAKAO TOKEN ERROR]', tokenData);
      return redirectToLogin(res);
    }

    const profileRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    const profileData = await profileRes.json();

    if (!profileRes.ok || !profileData?.id) {
      console.error('[KAKAO PROFILE ERROR]', profileData);
      return redirectToLogin(res);
    }

    const snsId = String(profileData.id);
    const email = profileData.kakao_account?.email || null;
    const nick = profileData.kakao_account?.profile?.nickname || 'kakao_user';

    const user = await authService.findOrCreateOAuthUser({
      provider: AUTH_PROVIDERS.KAKAO,
      email,
      nick,
      snsId,
    });

    return finishOAuthLogin(req, res, next, user);
  } catch (error) {
    console.error('[KAKAO CALLBACK ERROR]', error);
    return next(error);
  }
}

function redirectNaver(req, res, next) {
  const state = crypto.randomBytes(16).toString('hex');

  req.session.oauthState = state;

  req.session.save((err) => {
    if (err) {
      return next(err);
    }

    const redirectUri = encodeURIComponent(process.env.NAVER_CALLBACK_URL);
    const clientId = process.env.NAVER_CLIENT_ID;

    const url =
      `https://nid.naver.com/oauth2.0/authorize` +
      `?response_type=code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&state=${state}`;

    return res.redirect(url);
  });
}

async function naverCallback(req, res, next) {
  const { code, state } = req.query;

  if (!code || !state || state !== req.session.oauthState) {
    return redirectToLogin(res);
  }

  try {
    const tokenUrl =
      `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code` +
      `&client_id=${encodeURIComponent(process.env.NAVER_CLIENT_ID)}` +
      `&client_secret=${encodeURIComponent(process.env.NAVER_CLIENT_SECRET)}` +
      `&code=${encodeURIComponent(code)}` +
      `&state=${encodeURIComponent(state)}`;

    const tokenRes = await fetch(tokenUrl, { method: 'GET' });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[NAVER TOKEN ERROR]', tokenData);
      return redirectToLogin(res);
    }

    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const profileData = await profileRes.json();
    const profile = profileData?.response;

    if (!profileRes.ok || !profile?.id) {
      console.error('[NAVER PROFILE ERROR]', profileData);
      return redirectToLogin(res);
    }

    const snsId = String(profile.id);
    const email = profile.email || null;
    const nick = profile.nickname || profile.name || 'naver_user';

    const user = await authService.findOrCreateOAuthUser({
      provider: AUTH_PROVIDERS.NAVER,
      email,
      nick,
      snsId,
    });

    delete req.session.oauthState;

    return finishOAuthLogin(req, res, next, user);
  } catch (error) {
    console.error('[NAVER CALLBACK ERROR]', error);
    return next(error);
  }
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
  redirectKakao,
  kakaoCallback,
  redirectNaver,
  naverCallback,
};