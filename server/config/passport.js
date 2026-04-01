const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/auth.service');

function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, user.user_idx);
  });

  passport.deserializeUser(async (userIdx, done) => {
    try {
      const user = await authService.findUserById(userIdx);
      return done(null, user);
    } catch (error) {
      console.error('[DESERIALIZE USER ERROR]', error);
      return done(error);
    }
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_ID,
        clientSecret: process.env.GOOGLE_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile?.emails?.[0]?.value;
          const snsId = profile?.id;
          const nick = profile?.displayName || 'google_user';

          if (!email) {
            return done(new Error('구글 계정 이메일 정보를 가져오지 못했습니다.'));
          }

          let user = await authService.findGoogleUserByEmail(email);

          if (!user) {
            user = await authService.createGoogleUser({ email, nick, snsId });
          }

          return done(null, user);
        } catch (error) {
          console.error('[GOOGLE STRATEGY ERROR]', error);
          return done(error);
        }
      }
    )
  );
}

module.exports = configurePassport;