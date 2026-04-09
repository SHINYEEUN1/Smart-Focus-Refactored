const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/auth.service');
const { AUTH_PROVIDERS } = require('../../shared');

function configurePassport() {
  // serializeUser: 세션에 user 객체 전체 대신 user_idx만 저장.
  // 세션 크기를 최소화하고, 이후 요청마다 DB에서 최신 정보를 조회해
  // 회원 정보 변경이 즉시 반영될 수 있도록 하기 위함.
  passport.serializeUser((user, done) => {
    done(null, user.user_idx);
  });

  // deserializeUser: 요청마다 세션의 user_idx로 DB를 조회해 최신 user 정보를 req.user에 복원.
  // 캐시 대신 DB를 직접 조회하는 이유: 닉네임 변경 등 회원 정보 수정이 즉시 반영되어야 하기 때문.
  passport.deserializeUser(async (userIdx, done) => {
    try {
      const user = await authService.findUserById(userIdx);
      return done(null, user || false);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[DESERIALIZE USER ERROR]', error);
      }
      return done(error);
    }
  });

  // Google OAuth 전략만 passport-google-oauth20 라이브러리를 사용.
  // 카카오·네이버는 공식 passport 전략이 없거나 직접 구현이 유지보수에 더 유리해
  // auth.controller.js에서 fetch 기반으로 직접 처리함.
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_ID,
        clientSecret: process.env.GOOGLE_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile?.emails?.[0]?.value || null;
          const snsId = profile?.id;
          const nick = profile?.displayName || 'google_user';

          const user = await authService.findOrCreateOAuthUser({
            provider: AUTH_PROVIDERS.GOOGLE,
            email,
            nick,
            snsId,
          });

          return done(null, user);
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[GOOGLE STRATEGY ERROR]', error);
          }
          return done(error);
        }
      }
    )
  );
}

module.exports = configurePassport;