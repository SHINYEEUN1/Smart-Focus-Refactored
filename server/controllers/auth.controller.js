const crypto = require('crypto');

const authService = require('../services/auth.service');
const emailAuthService = require('../services/email-auth.service');
const { sendSuccess, sendFail } = require('../utils/response');
const { isValidEmail, isNonEmptyString } = require('../utils/validators');
const { RESPONSE_CODES, AUTH_PROVIDERS } = require('../../shared');

// 개발 환경에서만 에러 로그를 출력하기 위한 플래그.
// production에서는 에러 세부 내용을 노출하지 않는다.
const DEBUG = process.env.NODE_ENV !== 'production';

function getClientUrl() {
  return process.env.CLIENT_URL || 'http://localhost:5173';
}

function redirectToLogin(res) {
  return res.redirect(`${getClientUrl()}/login`);
}

function redirectToDashboard(res) {
  return res.redirect(`${getClientUrl()}/dashboard`);
}

// OAuth 로그인 공통 완료 처리.
// req.login으로 세션에 사용자를 등록한 뒤, 세션을 저장하고 대시보드로 리디렉트한다.
// 세션 저장을 명시적으로 호출하는 이유: express-session의 saveUninitialized: false 설정 시
// 세션이 자동 저장되지 않아 이후 요청에서 로그인 정보가 유실될 수 있기 때문이다.
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

// OAuth 토큰 발급 요청의 응답 유효성을 확인하는 공통 헬퍼.
// 공급자(카카오/네이버)마다 토큰 발급 실패 방식이 동일하므로 추출함.
// 실패 시 개발 환경에서만 에러 내용을 출력하고, 로그인 페이지로 리디렉트한다.
async function fetchOAuthToken(url, options, providerName) {
  const tokenResponse = await fetch(url, options);
  const tokenPayload = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    if (DEBUG) console.error(`[${providerName} TOKEN ERROR]`, tokenPayload);
    return null;
  }

  return tokenPayload;
}

// OAuth 프로필 조회 요청의 응답 유효성을 확인하는 공통 헬퍼.
// 토큰을 Bearer로 실어 보내는 방식이 카카오/네이버 모두 동일하므로 추출함.
// 프로필 ID 미포함 시 개발 환경에서만 에러 내용을 출력하고, null 반환.
async function fetchOAuthProfile(url, accessToken, providerName) {
  const profileResponse = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const profilePayload = await profileResponse.json();

  if (!profileResponse.ok || !profilePayload?.id) {
    if (DEBUG) console.error(`[${providerName} PROFILE ERROR]`, profilePayload);
    return null;
  }

  return profilePayload;
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

    if (DEBUG) console.error('[SEND EMAIL ERROR]', error);
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

// Google OAuth는 passport-google-oauth20이 콜백 처리를 완료한 뒤
// req.user에 사용자 정보를 이미 설정해두기 때문에 별도의 토큰 교환이 필요 없다.
// 세션 저장 후 대시보드로 리디렉트만 수행한다.
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

// 카카오 로그인 진입 시 카카오 인증 서버로 리디렉트.
// 카카오는 passport 전략 없이 직접 fetch로 구현하므로, 인가 코드 요청 URL을 수동으로 생성한다.
function redirectKakao(_req, res) {
  const redirectUri = encodeURIComponent(process.env.KAKAO_CALLBACK_URL);
  const clientId = process.env.KAKAO_CLIENT_ID;

  const url =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code`;

  return res.redirect(url);
}

// 카카오 인증 서버가 인가 코드와 함께 돌아오면 실행되는 콜백.
// 1단계: 인가 코드로 액세스 토큰 발급
// 2단계: 액세스 토큰으로 사용자 프로필 조회
// 3단계: DB에서 기존 회원 조회 또는 신규 가입 처리
async function kakaoCallback(req, res, next) {
  const { code } = req.query;

  if (!code) {
    return redirectToLogin(res);
  }

  try {
    // 카카오 토큰 엔드포인트는 application/x-www-form-urlencoded 형식만 허용하므로 URLSearchParams 사용
    const tokenPayload = await fetchOAuthToken(
      'https://kauth.kakao.com/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.KAKAO_CLIENT_ID,
          client_secret: process.env.KAKAO_CLIENT_SECRET || '',
          redirect_uri: process.env.KAKAO_CALLBACK_URL,
          code,
        }),
      },
      'KAKAO'
    );

    if (!tokenPayload) return redirectToLogin(res);

    // 카카오 프로필 API: id 필드가 없으면 유효하지 않은 응답으로 처리
    const profilePayload = await fetchOAuthProfile(
      'https://kapi.kakao.com/v2/user/me',
      tokenPayload.access_token,
      'KAKAO'
    );

    if (!profilePayload?.id) return redirectToLogin(res);

    const snsId = String(profilePayload.id);
    const email = profilePayload.kakao_account?.email || null;
    const nick = profilePayload.kakao_account?.profile?.nickname || 'kakao_user';

    const user = await authService.findOrCreateOAuthUser({
      provider: AUTH_PROVIDERS.KAKAO,
      email,
      nick,
      snsId,
    });

    return finishOAuthLogin(req, res, next, user);
  } catch (error) {
    if (DEBUG) console.error('[KAKAO CALLBACK ERROR]', error);
    return next(error);
  }
}

// 네이버 로그인 진입 시 네이버 인증 서버로 리디렉트.
// CSRF 방지를 위해 state 값을 crypto로 생성하여 세션에 저장한다.
// 콜백에서 state가 일치하는지 검증해 위조된 요청을 차단한다.
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

// 네이버 인증 서버가 인가 코드와 함께 돌아오면 실행되는 콜백.
// state 검증 → 토큰 발급 → 프로필 조회 → DB 처리 순서로 진행한다.
// 네이버 프로필 응답은 data.response 하위에 실제 사용자 정보가 있다.
async function naverCallback(req, res, next) {
  const { code, state } = req.query;

  // state 불일치 시 CSRF 공격 또는 잘못된 요청으로 간주하여 로그인 페이지로 이동
  if (!code || !state || state !== req.session.oauthState) {
    return redirectToLogin(res);
  }

  try {
    // 네이버 토큰 엔드포인트는 GET 방식으로 쿼리 파라미터를 전달받는다
    const tokenUrl =
      `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code` +
      `&client_id=${encodeURIComponent(process.env.NAVER_CLIENT_ID)}` +
      `&client_secret=${encodeURIComponent(process.env.NAVER_CLIENT_SECRET)}` +
      `&code=${encodeURIComponent(code)}` +
      `&state=${encodeURIComponent(state)}`;

    const tokenPayload = await fetchOAuthToken(tokenUrl, { method: 'GET' }, 'NAVER');

    if (!tokenPayload) return redirectToLogin(res);

    // 네이버 프로필 응답은 { resultcode, message, response: { id, email, ... } } 구조
    const rawProfilePayload = await fetch('https://openapi.naver.com/v1/nid/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });

    const profilePayload = await rawProfilePayload.json();
    const profile = profilePayload?.response;

    if (!rawProfilePayload.ok || !profile?.id) {
      if (DEBUG) console.error('[NAVER PROFILE ERROR]', profilePayload);
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

    // 세션에 저장했던 oauthState는 콜백 처리 후 더 이상 필요 없으므로 제거
    delete req.session.oauthState;

    return finishOAuthLogin(req, res, next, user);
  } catch (error) {
    if (DEBUG) console.error('[NAVER CALLBACK ERROR]', error);
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
