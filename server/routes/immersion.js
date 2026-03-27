const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * [1] 집중 시작 API (POST /api/immersion/start)
 */
router.post('/start', async (req, res) => {
    const { user_idx } = req.body;
    const now = new Date();
    const imm_date = now.toISOString().split('T')[0];
    const start_time = now.toTimeString().split(' ')[0];

    try {
        // [변경] imm_score와 max_good_streak 기본값 0으로 시작
        const sql = "INSERT INTO immersions (user_idx, imm_date, start_time, imm_score, max_good_streak) VALUES (?, ?, ?, 0, 0)";
        const [result] = await db.query(sql, [user_idx, imm_date, start_time]);
        
        res.json({ success: true, imm_idx: result.insertId });
    } catch (err) {
        console.error("세션 시작 실패:", err);
        res.status(500).json({ success: false, message: "세션 시작 중 오류 발생" });
    }
});

/**
 * [2] 실시간 로그 기록 API (POST /api/immersion/log)
 */
router.post('/log', async (req, res) => {
    const { imm_idx, noise, pose } = req.body; 

    try {
        // 1. 소음 데이터 저장 (reliability, is_summary 반영)
        if (noise) {
            const noiseSql = `
                INSERT INTO noises (imm_idx, decibel, obj_name, reliability, is_summary, detected_at) 
                VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
            `;
            await db.query(noiseSql, [
                imm_idx, 
                noise.decibel, 
                noise.obj_name, 
                noise.reliability || 0
            ]);
        }

        // 2. 자세 데이터 저장 (pose_status, pose_type, count 반영)
        if (pose) {
            const poseSql = `
                INSERT INTO poses (imm_idx, pose_status, pose_type, count, detected_at) 
                VALUES (?, ?, ?, 1, NOW())
            `;
            await db.query(poseSql, [
                imm_idx, 
                pose.pose_status, 
                pose.pose_type
            ]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[LOG ERROR] 데이터 저장 실패:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * [3] 집중 종료 API (POST /api/immersion/end) - 포인트 적립 추가!
 */
router.post('/end', async (req, res) => {
    const { imm_idx, user_idx } = req.body; // user_idx가 포인트 지급을 위해 필요합니다.
    const end_time = new Date().toTimeString().split(' ')[0];

    try {
        // 1. 감점 요인 조회
        const [poseStats] = await db.query(
            "SELECT COUNT(*) as cnt FROM poses WHERE imm_idx = ? AND pose_status = 'BAD'", [imm_idx]
        );
        const [noiseStats] = await db.query(
            "SELECT COUNT(*) as cnt FROM noises WHERE imm_idx = ?", [imm_idx]
        );

        const badPoseCount = poseStats[0].cnt;
        const noiseCount = noiseStats[0].cnt;

        // 2. 점수 계산
        let final_score = 100 - (badPoseCount * 5) - (noiseCount * 2);
        if (final_score < 0) final_score = 0;

        // 🌟 [추가] 포인트 계산 및 지급 로직
        // 예: 점수가 80점 이상이면 50포인트, 그 외는 10포인트 (기준은 마음대로 조정 가능)
        const rewardPoint = final_score >= 80 ? 50 : 10;
        const pointSql = "INSERT INTO points (user_idx, reward_type, reward_point, earned_at) VALUES (?, '집중 보상', ?, CURRENT_TIMESTAMP)";
        await db.query(pointSql, [user_idx, rewardPoint]);

        // 3. immersions 테이블 업데이트 (max_good_streak은 일단 0으로 유지하거나 클라이언트에서 받아 처리)
        const sql = "UPDATE immersions SET end_time = ?, imm_score = ? WHERE imm_idx = ?";
        await db.query(sql, [end_time, final_score, imm_idx]);

        res.json({ 
            success: true, 
            calculated_score: final_score,
            earned_points: rewardPoint,
            details: { bad_poses: badPoseCount, noises: noiseCount }
        });

    } catch (err) {
        console.error("세션 종료 실패:", err);
        res.status(500).json({ success: false, message: "종료 처리 중 오류" });
    }
});

/**
 * [4] 리포트 데이터 조회 (GET /api/immersion/report/:imm_idx)
 */
router.get('/report/:imm_idx', async (req, res) => {
    const { imm_idx } = req.params;
    
    try {
        // 1. 세션 + 피드백 정보 함께 조회 (LEFT JOIN feedbacks)
        const [info] = await db.query(`
            SELECT i.*, f.fb_content,
            TIMESTAMPDIFF(SECOND, CONCAT(i.imm_date, ' ', i.start_time), CONCAT(i.imm_date, ' ', i.end_time)) AS total_seconds
            FROM immersions i
            LEFT JOIN feedbacks f ON i.imm_idx = f.imm_idx
            WHERE i.imm_idx = ?`, [imm_idx]);

        if (info.length === 0) return res.status(404).json({ success: false, message: "세션 없음" });

        // 2. 소음/자세 요약 조회
        const [noise] = await db.query(`SELECT AVG(decibel) as avg_decibel, COUNT(*) as total_count FROM noises WHERE imm_idx = ?`, [imm_idx]);
        const [poses] = await db.query(`SELECT pose_status, COUNT(*) as count FROM poses WHERE imm_idx = ? GROUP BY pose_status`, [imm_idx]);

        res.json({ 
            success: true, 
            data: {
                session: info[0],
                noise_summary: noise[0],
                pose_summary: poses
            }
        });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;