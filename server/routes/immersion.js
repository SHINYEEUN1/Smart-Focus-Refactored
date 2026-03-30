const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * [1] 집중 시작 API
 */
router.post('/start', async (req, res) => {
    const user_idx = req.body.user_idx || (req.session?.user?.user_idx) || 1;
    try {
        const sql = `INSERT INTO immersions (user_idx, imm_date, start_time, imm_score, max_good_streak) 
                     VALUES (?, CURDATE(), CURTIME(), 0, 0)`;
        const [result] = await db.query(sql, [user_idx]);
        res.json({ success: true, imm_idx: result.insertId });
    } catch (err) {
        console.error("세션 시작 실패:", err);
        res.status(500).json({ success: false });
    }
});

/**
 * [2] 실시간 로그 기록 API (★ 에러 해결 핵심 ★)
 */
router.post('/log', async (req, res) => {
    console.log("==== [DEBUG] 리액트에서 받은 원본 데이터 ====");
    console.log(req.body);
    // 리액트에서 보낸 전체 데이터를 일단 받음
    const { imm_idx, noise, pose } = req.body; 

    try {
        // 1. 소음 데이터 저장
        if (noise) {
            const noiseSql = `INSERT INTO noises (imm_idx, decibel, obj_name, reliability, is_summary, detected_at) 
                              VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`;
            await db.query(noiseSql, [imm_idx, noise.decibel || 0, noise.obj_name || 'none', noise.reliability || 0]);
        }

        // 2. 자세 데이터 저장 (에러 원천 차단 로직)
        if (pose) {
            // 리액트에서 pose_status/pose_type이 안 올 경우를 대비한 3중 방어
            const p_status = pose.pose_status || pose.status || 'NORMAL';
            
            // 리액트에서 pose_type을 안 보냈더라도 여기서 'GOOD' 또는 'BAD'를 강제로 생성
            let p_type = pose.pose_type;
            if (!p_type) {
                p_type = (p_status === 'GOOD_POSTURE' || p_status === 'NORMAL') ? 'GOOD' : 'BAD';
                }
console.log("---- [DEBUG] DB 저장 직전 변수 상태 ----");
            console.log("- imm_idx:", imm_idx);
            console.log("- p_type:", p_type); // 이 값이 undefined면 에러 발생!
            console.log("- p_status:", p_status);
            const poseSql = `INSERT INTO poses (imm_idx, pose_type, pose_status, count, detected_at) 
                             VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`;
        
            // DB 컬럼 순서에 맞춰 p_type을 확실하게 전달
            await db.query(poseSql, [imm_idx, p_type, p_status]);
        }
        res.json({ success: true });
    } catch (err) {
        // 에러 시 어떤 데이터가 들어왔길래 실패했는지 로그 출력
        console.error("[LOG ERROR] 데이터 저장 실패:", err.message);
        console.log("받은 데이터(pose):", pose); 
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * [3] 집중 종료 API (user_idx NULL 에러 방어)
 */
router.post('/end', async (req, res) => {
    const { imm_idx, user_idx: bodyUserIdx, imm_score } = req.body; 
    const user_idx = bodyUserIdx || (req.session?.user?.user_idx) || 1;

    try {
        const [poseStats] = await db.query("SELECT COUNT(*) as cnt FROM poses WHERE imm_idx = ? AND pose_type = 'BAD'", [imm_idx]);
        const badPoseCount = poseStats[0]?.cnt || 0;

        let final_score = imm_score !== undefined ? imm_score : (100 - (badPoseCount * 5));
        if (final_score < 0) final_score = 0;

        // 포인트 지급
        const rewardPoint = final_score >= 80 ? 50 : 10;
        await db.query("INSERT INTO points (user_idx, reward_type, reward_point, earned_at) VALUES (?, '집중 보상', ?, CURRENT_TIMESTAMP)", [user_idx, rewardPoint]);

        // 종료 시간 업데이트
        await db.query("UPDATE immersions SET end_time = CURTIME(), imm_score = ? WHERE imm_idx = ?", [final_score, imm_idx]);

        res.json({ success: true, calculated_score: final_score, earned_points: rewardPoint });
    } catch (err) {
        console.error("세션 종료 실패:", err.message);
        res.status(500).json({ success: false });
    }
});

/**
 * [4] 리포트 데이터 조회
 */
router.get('/report/:imm_idx', async (req, res) => {
    const { imm_idx } = req.params;
    try {
        // 1. 세션 기본 정보
        const [sessionInfo] = await db.query(`
            SELECT *, 
            TIMESTAMPDIFF(SECOND, CONCAT(imm_date, ' ', start_time), 
            IFNULL(CONCAT(imm_date, ' ', end_time), CURRENT_TIMESTAMP)) as total_seconds 
            FROM immersions WHERE imm_idx = ?`, [imm_idx]);

        if (sessionInfo.length === 0) return res.status(404).json({ success: false });

        // 2. 소음 요약
        const [noiseSummary] = await db.query(`
            SELECT 
                AVG(decibel) as avg_decibel, 
                (SELECT obj_name 
                 FROM noises 
                 WHERE imm_idx = ? AND decibel
                 GROUP BY obj_name 
                 ORDER BY COUNT(*) DESC LIMIT 1) as main_obstacle 
            FROM noises WHERE imm_idx = ?`, [imm_idx, imm_idx]);

        // 3. 자세 요약
        const [poseSummary] = await db.query(`
            SELECT pose_status, COUNT(*) as count 
            FROM poses WHERE imm_idx = ? GROUP BY pose_status`, [imm_idx]);

        // 4. 차트 데이터
       const [chartData] = await db.query(`
    SELECT 
        time_label, 
        MAX(imm_score) as imm_score, 
        MAX(decibel) as decibel
    FROM (
        SELECT 
            DATE_FORMAT(detected_at, '%H:%i:%s') as time_label,
            CASE 
                WHEN pose_type = 'GOOD' THEN 100 
                WHEN pose_type = 'BAD' THEN 40 
                ELSE NULL 
            END as imm_score,
            NULL as decibel,
            detected_at
        FROM poses WHERE imm_idx = ?

        UNION ALL

        SELECT 
            DATE_FORMAT(detected_at, '%H:%i:%s') as time_label,
            NULL as imm_score,
            decibel,
            detected_at
        FROM noises WHERE imm_idx = ?
    ) AS combined_data
    GROUP BY time_label
    /* [수정] HAVING 절은 삭제했습니다. 소음 데이터가 누락되지 않게 하기 위해서입니다. */
    ORDER BY MIN(detected_at) ASC
`, [imm_idx, imm_idx]);

// 💡 [핵심 추가] 직전 값으로 빈틈을 메우는 로직 (Forward Fill)
let last_score = 100;   // 초기 점수 기본값
let last_decibel = 30; // 초기 소음 기본값 (조용한 상태)

const filledChartData = chartData.map(item => {
    // 점수가 NULL이면 이전 점수를 그대로 쓰고, 데이터가 있으면 갱신
    if (item.imm_score !== null) {
        last_score = item.imm_score;
    } else {
        item.imm_score = last_score;
    }

    // 소음 데이터가 NULL이면 이전 소음을 그대로 쓰고, 데이터가 있으면 갱신
    if (item.decibel !== null) {
        last_decibel = item.decibel;
    } else {
        item.decibel = last_decibel;
    }

    return item;
});

// [응답 전송] filledChartData를 보냅니다.
        res.json({ 
            success: true, 
            data: { 
            session: sessionInfo[0], 
            noise_summary: noiseSummary[0], 
            pose_summary: poseSummary,
            chart_data: filledChartData // 👈 가공된 데이터를 전송!
    } 
        });

    } catch (err) {
        console.error("리포트 조회 에러:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}); 

module.exports = router;
