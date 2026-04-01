const express = require('express');
const router = express.Router();

const mypageController = require('../controllers/mypage.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');

router.get('/stats/:user_idx', isAuthenticated, mypageController.getStats);
router.get('/history/:user_idx', isAuthenticated, mypageController.getHistory);

module.exports = router;