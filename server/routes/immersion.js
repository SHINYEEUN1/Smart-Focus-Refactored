const express = require('express');
const router = express.Router();

const immersionController = require('../controllers/immersion.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');

router.post('/start', isAuthenticated, immersionController.startSession);
// 실시간 socket 실패 시 fallback API
router.post('/log', isAuthenticated, immersionController.logData);
router.post('/end', isAuthenticated, immersionController.endSession);
router.get('/report/:imm_idx', isAuthenticated, immersionController.getReport);

module.exports = router;