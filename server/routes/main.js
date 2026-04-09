const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 서버와 DB 연결 상태를 한 번에 확인하는 헬스 체크 엔드포인트.
// 서버는 응답하지만 DB 연결이 끊긴 경우도 감지할 수 있도록 실제 쿼리를 실행한다.
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
    // DB 연결 에러는 서버 전체에 영향을 주므로 항상 공통 에러 핸들러로 전달한다.
    next(error);
  }
});

module.exports = router;
