const express = require('express');
const router = express.Router();
const db = require('../config/database');

// [중요] 유저 라우터에서 가져온 인증 미들웨어가 있다고 가정 (보안 강화)
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) next();
    else res.status(401).json({ success: false, message: "로그인이 필요합니다." });
};

/**
 * [1] 마이페이지 메인 통계
 */
router.get('/stats/:user_idx', isAuthenticated, async (req, res) => {
    const { user_idx } = req.params;

    // 본인 데이터인지 검증 (선택 사항이지만 권장)
    if (parseInt(user_idx) !== req.session.user.user_idx) {
        return res.status(403).json({ success: false, message: "권한이 없습니다." });
    }

    try {
        const sql = `
            SELECT 
                (SELECT COUNT(*) FROM immersions WHERE user_idx = ?) as total_sessions,
                (SELECT IFNULL(SUM(reward_point), 0) FROM points WHERE user_idx = ?) as total_points,
                (SELECT COUNT(*) FROM user_badges WHERE user_idx = ?) as badge_count,
                /* NULL 방지를 위해 IFNULL 위치 조정 */
                IFNULL(SUM(TIMESTAMPDIFF(SECOND, start_time, end_time)), 0) as total_seconds,
                IFNULL(AVG(imm_score), 0) as avg_score
            FROM immersions 
            WHERE user_idx = ? AND end_time IS NOT NULL
        `;
        
        const [stats] = await db.query(sql, [user_idx, user_idx, user_idx, user_idx]);
        
        const total = stats[0].total_seconds;
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;

        res.json({ 
            success: true, 
            data: {
                ...stats[0],
                avg_score: parseFloat(stats[0].avg_score).toFixed(1), // 소수점 한자리 고정
                formatted_time: hours > 0 
                    ? `${hours}시간 ${minutes}분 ${seconds}초` 
                    : `${minutes}분 ${seconds}초`
            } 
        });
    } catch (err) {
        console.error("통계 조회 실패:", err);
        res.status(500).json({ success: false });
    }
});

/**
 * [2] 집중 히스토리 목록
 */
router.get('/history/:user_idx', isAuthenticated, async (req, res) => {
    const { user_idx } = req.params;

    try {
        const sql = `
            SELECT 
                i.imm_idx, i.imm_date, i.start_time, i.end_time, i.imm_score,
                (SELECT COUNT(*) FROM poses p WHERE p.imm_idx = i.imm_idx) as pose_count
            FROM immersions i
            WHERE i.user_idx = ? AND i.end_time IS NOT NULL
            ORDER BY i.imm_date DESC, i.start_time DESC
            LIMIT 20
        `;
        const [history] = await db.query(sql, [user_idx]);
        res.json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;