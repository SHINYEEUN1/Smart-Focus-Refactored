const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const passport = require('passport');

router.post('/send-email', authController.sendEmailCode);
router.post('/verify-code', authController.verifyEmailCode);
router.post('/join', authController.join);
router.post('/check-nick', authController.checkNick);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/session', isAuthenticated, authController.getSession);

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login`,
    session: true,
  }),
  authController.googleCallback
);

router.get('/kakao', authController.redirectKakao);
router.get('/kakao/callback', authController.kakaoCallback);

router.get('/naver', authController.redirectNaver);
router.get('/naver/callback', authController.naverCallback);

module.exports = router;