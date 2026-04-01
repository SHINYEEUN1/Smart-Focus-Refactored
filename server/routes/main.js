const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT '연결 완료' AS status");
    const dbStatus = rows[0]?.status || 'UNKNOWN';

    res.json({
      success: true,
      message: '서버와 DB가 모두 정상입니다!',
      dbStatus,
    });
  } catch (error) {
    console.error('[MAIN ROUTE ERROR]', error.message);
    next(error);
  }
});

module.exports = router;