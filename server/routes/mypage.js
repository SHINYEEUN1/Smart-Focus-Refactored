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

    if (parseInt(user_idx) !== req.session.user.user_idx) {
        return res.status(403).json({ success: false, message: "권한이 없습니다." });
    }

    try {
        const sql = `
            SELECT 
                (SELECT COUNT(*) FROM immersions WHERE user_idx = ?) as total_sessions,
                (SELECT IFNULL(SUM(reward_point), 0) FROM points WHERE user_idx = ?) as total_points,
                (SELECT COUNT(*) FROM user_badges WHERE user_idx = ?) as badge_count,
                IFNULL(SUM(TIMESTAMPDIFF(SECOND, start_time, end_time)), 0) as total_seconds,
                
                /* [수정 포인트] 상세 포즈 기록(poses)에서 전체 평균 점수를 계산 */
                (
                    SELECT IFNULL(AVG(CASE WHEN pose_type = 'GOOD' THEN 100 ELSE 40 END), 0)
                    FROM poses p
                    JOIN immersions i_sub ON p.imm_idx = i_sub.imm_idx
                    WHERE i_sub.user_idx = ?
                ) as avg_score
            FROM immersions 
            WHERE user_idx = ? AND end_time IS NOT NULL
        `;
        
        // user_idx가 5번 들어갑니다.
        const [stats] = await db.query(sql, [user_idx, user_idx, user_idx, user_idx, user_idx]);
        
        const row = stats[0];
        const total = row.total_seconds;
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;

        res.json({ 
            success: true, 
            data: {
                ...row,
                // 숫자로 확실히 변환 후 소수점 처리
                avg_score: Number(row.avg_score).toFixed(1), 
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
                i.imm_idx, i.imm_date, i.start_time, i.end_time,
                /* i.imm_score 대신 여기서 직접 평균 계산 */
                (SELECT IFNULL(AVG(CASE WHEN p.pose_type = 'GOOD' THEN 100 ELSE 40 END), 0) 
                 FROM poses p WHERE p.imm_idx = i.imm_idx) as imm_score,
                (SELECT COUNT(*) FROM poses p WHERE p.imm_idx = i.imm_idx) as pose_count
            FROM immersions i
            WHERE i.user_idx = ? AND i.end_time IS NOT NULL
            ORDER BY i.imm_date DESC, i.start_time DESC
            LIMIT 20
        `;
        const [history] = await db.query(sql, [user_idx]);
        
        // 소수점 처리
        const formattedHistory = history.map(item => ({
            ...item,
            imm_score: Number(item.imm_score).toFixed(1)
        }));

        res.json({ success: true, data: formattedHistory });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;