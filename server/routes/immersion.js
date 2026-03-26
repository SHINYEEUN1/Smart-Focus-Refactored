const express = require('express');
const router = express.Router();
const db = require('../config/database'); // DB 설정 파일 경로

/**
 * [1] 집중 시작 API (POST /api/immersion/start)
 */
router.post('/start', async (req, res) => {
    const { user_idx } = req.body;
    const now = new Date();
    const imm_date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const start_time = now.toTimeString().split(' ')[0]; // HH:mm:ss

    try {
        const sql = "INSERT INTO immersions (user_idx, imm_date, start_time, imm_score) VALUES (?, ?, ?, 0)";
        const [result] = await db.query(sql, [user_idx, imm_date, start_time]);
        
        // 생성된 imm_idx를 리턴하여 이후 로그 기록 시 사용하게 합니다.
        res.json({ success: true, imm_idx: result.insertId });
    } catch (err) {
        console.error("세션 시작 실패:", err);
        res.status(500).json({ success: false, message: "세션 시작 중 오류 발생" });
    }
});

/**
 * [2] 실시간 중요 이벤트 기록 API
 */
router.post('/log', async (req, res) => {
    const { imm_idx, noise, pose } = req.body; 

    try {
        // 1. 소음 데이터 저장 (reliability 컬럼 반영)
        if (noise) {
            const noiseSql = `
                INSERT INTO noises (imm_idx, decibel, obj_name, reliability, detected_at) 
                SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (
                    SELECT 1 FROM noises 
                    WHERE imm_idx = ? 
                      AND detected_at >= DATE_SUB(NOW(), INTERVAL 1 SECOND)
                      AND decibel = ?
                )
            `;
            await db.query(noiseSql, [
                imm_idx, 
                noise.decibel, 
                noise.obj_name, 
                noise.reliability || 0, // 데이터 없을 시 0 기본값
                imm_idx, 
                noise.decibel
            ]);
        }

        // 2. 자세 데이터 저장 (pose_status 등 DB 명세 반영)
        if (pose) {
            const poseSql = `
                INSERT INTO poses (imm_idx, pose_status, pose_type, detected_at) 
                SELECT ?, ?, ?, NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM poses 
                    WHERE imm_idx = ? 
                      AND detected_at >= DATE_SUB(NOW(), INTERVAL 1 SECOND)
                      AND pose_status = ?
                )
            `;
            await db.query(poseSql, [
                imm_idx, 
                pose.pose_status, 
                pose.pose_type, 
                imm_idx, 
                pose.pose_status
            ]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("[LOG ERROR] 데이터 저장 실패:", err.message);
        // 에러 발생 시 리액트가 재시도할 수 있도록 503 또는 500 전송
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * [3] 집중 종료 API (POST /api/immersion/end)
 */
router.post('/end', async (req, res) => {
    const { imm_idx } = req.body; 
    const end_time = new Date().toTimeString().split(' ')[0];

    try {
        // 1. 해당 세션의 감점 요인(나쁜 자세 횟수 & 소음 발생 횟수) 데이터 조회
        const [poseStats] = await db.query(
            "SELECT COUNT(*) as cnt FROM poses WHERE imm_idx = ? AND pose_type = 'BAD'", [imm_idx]
        );
        const [noiseStats] = await db.query(
            "SELECT COUNT(*) as cnt FROM noises WHERE imm_idx = ?", [imm_idx]
        );

        const badPoseCount = poseStats[0].cnt;
        const noiseCount = noiseStats[0].cnt;

        // 2. 점수 계산 로직 (기본 100점 시작)
        // 나쁜 자세 1회당 -5점, 소음 1회당 -2점 차감 (0점 미만 방지)
        let final_score = 100 - (badPoseCount * 5) - (noiseCount * 2);
        if (final_score < 0) final_score = 0;

        // 3. immersions 테이블에 최종 종료 시간과 계산된 점수 업데이트
        const sql = "UPDATE immersions SET end_time = ?, imm_score = ? WHERE imm_idx = ?";
        await db.query(sql, [end_time, final_score, imm_idx]);

        // 4. 결과 응답 (리액트는 이 score를 받아 결과 화면에 띄우기만 하면 됩니다)
        res.json({ 
            success: true, 
            calculated_score: final_score,
            details: {
                bad_poses: badPoseCount,
                noises: noiseCount
            }
        });

    } catch (err) {
        console.error("세션 종료 및 점수 산출 실패:", err);
        res.status(500).json({ success: false, message: "종료 처리 중 서버 오류" });
    }
});

/**
 * [4] 리포트 데이터 조회 API (GET /api/immersion/report/:imm_idx)
 */
router.get('/report/:imm_idx', async (req, res) => {
    const { imm_idx } = req.params;
    
    try {
        // 1. 기본 세션 정보
        const [info] = await db.query(`
            SELECT *, TIMESTAMPDIFF(SECOND, CONCAT(imm_date, ' ', start_time), CONCAT(imm_date, ' ', end_time)) AS total_seconds
            FROM immersions WHERE imm_idx = ?`, [imm_idx]);

        if (info.length === 0) return res.status(404).json({ success: false, message: "세션 없음" });

        // 2. 소음 요약
        const [noise] = await db.query(`
            SELECT ROUND(AVG(decibel), 1) as avg_decibel, COUNT(*) as total_count,
            (SELECT obj_name FROM noises WHERE imm_idx = ? GROUP BY obj_name ORDER BY COUNT(*) DESC LIMIT 1) as top_noise
            FROM noises WHERE imm_idx = ?`, [imm_idx, imm_idx]);

        // 3. 자세 요약
        const [poses] = await db.query(`
            SELECT pose_status, COUNT(*) as count FROM poses WHERE imm_idx = ? GROUP BY pose_status`, [imm_idx]);

        // 🌟 4. [추가] 차트용 시계열 데이터 조회 
        // 시간순으로 소음과 당시 기록을 가져와서 그래프를 그리게 해줍니다.
        const [chartLogs] = await db.query(`
            SELECT 
                DATE_FORMAT(detected_at, '%H:%i:%s') as time_label,
                decibel,
                obj_name
            FROM noises 
            WHERE imm_idx = ?
            ORDER BY detected_at ASC
        `, [imm_idx]);

        // 최종 응답 데이터 조립
        res.json({ 
            success: true, 
            data: {
                session: info[0],
                noise_summary: {
                    average: noise[0].avg_decibel || 0,
                    count: noise[0].total_count,
                    main_obstacle: noise[0].top_noise || "없음"
                },
                pose_summary: poses,
                chart_data: chartLogs // 차트 데이터
            }
        });
    } catch (err) {
        console.error("리포트 조회 실패:", err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;