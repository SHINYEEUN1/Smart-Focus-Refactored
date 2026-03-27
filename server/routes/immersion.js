const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * [1] 집중 시작 API
 */
router.post('/start', async (req, res) => {
    const { user_idx } = req.body;
    const now = new Date();
    // 💡 날짜와 시간 포맷을 DB가 좋아하는 형태로 확실히 고정
    const imm_date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const start_time = now.toTimeString().split(' ')[0];

    try {
        const sql = "INSERT INTO immersions (user_idx, imm_date, start_time, imm_score) VALUES (?, ?, ?, 100)";
        const [result] = await db.query(sql, [user_idx, imm_date, start_time]);
        res.json({ success: true, imm_idx: result.insertId });
    } catch (err) {
        console.error("시작 에러:", err);
        res.status(500).json({ success: false, message: "세션 시작 중 오류 발생" });
    }
});

/**
 * [2] 집중 종료 및 포인트 지급 API
 */
router.post('/end', async (req, res) => {
    const { imm_idx, imm_score } = req.body; 
    // 💡 user_idx가 1로 고정되어 들어오는지 확인이 필요합니다.
    const user_idx = req.body.user_idx || 1; 
    const end_time = new Date().toTimeString().split(' ')[0];

    if (!imm_idx) {
        return res.status(400).json({ success: false, message: "imm_idx가 누락되었습니다." });
    }

    const conn = await db.getConnection(); 
    try {
        await conn.beginTransaction(); 

        // 0. 중복 종료 확인
        const [check] = await conn.query("SELECT end_time FROM immersions WHERE imm_idx = ?", [imm_idx]);
        if (check[0] && check[0].end_time) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: "이미 종료된 세션입니다." });
        }

        const final_score = imm_score !== undefined ? imm_score : 0;
        const rewardPoint = final_score >= 80 ? 50 : 10;

        // 1. 포인트 지급 기록 (백틱 처리로 예약어 충돌 방지)
        await conn.query(
            "INSERT INTO points (user_idx, `reward_type`, `reward_point`, earned_at) VALUES (?, 'FOCUS_REWARD', ?, NOW())",
            [user_idx, rewardPoint]
        );

        // 2. 세션 종료 정보 업데이트
        const sql = `UPDATE immersions SET end_time = ?, imm_score = ? WHERE imm_idx = ?`;
        await conn.query(sql, [end_time, final_score, imm_idx]);

        await conn.commit(); 
        res.json({ success: true, final_score, earned_points: rewardPoint });

    } catch (err) {
        if (conn) await conn.rollback(); 
        console.error("❌ 종료 에러 상세:", err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        if (conn) conn.release(); 
    }
});

/**
 * [3] 최종 리포트 조회 API
 */
router.get('/report/:imm_idx', async (req, res) => {
    const { imm_idx } = req.params;
    
    try {
        // 1. 세션 기본 정보 및 총 시간 계산
        const [sessionInfo] = await db.query(`
            SELECT *, 
            TIMESTAMPDIFF(SECOND, start_time, end_time) AS total_seconds 
            FROM immersions WHERE imm_idx = ?`, [imm_idx]);

        if (!sessionInfo || sessionInfo.length === 0) {
            return res.status(404).json({ success: false, message: "데이터 없음" });
        }

        // 2. 자세 통계 (pose_summary)
        const [poseStats] = await db.query(
            `SELECT pose_status, COUNT(*) as count FROM poses WHERE imm_idx = ? GROUP BY pose_status`, 
            [imm_idx]
        );

        // 3. 차트 데이터 및 소음 (리액트가 예상하는 구조 생성)
        // 실제 noise 테이블이 없다면 임시 데이터를, 있다면 해당 테이블을 조회하세요.
        // 여기서는 에러 방지를 위해 최소한의 구조를 만들어 보냅니다.
        res.json({
            success: true,
            data: {
                session: sessionInfo[0],
                pose_summary: poseStats,
                noise_summary: { main_obstacle: "없음" }, // 임시 데이터
                chart_data: [
                    { 
                        time_label: sessionInfo[0].start_time, 
                        imm_score: sessionInfo[0].imm_score, 
                        decibel: 30 
                    }
                ]
            }
        });

    } catch (err) {
        console.error("리포트 조회 에러:", err);
        res.status(500).json({ success: false });
    }
});

/**
 * [4] 마이페이지 통합 데이터 조회 (세션 기반 실데이터 반영)
 */
router.get('/my/dashboard', async (req, res) => {
    const user = req.session.user;

    if (!user || !user.user_idx) {
        return res.status(401).json({ success: false, message: "로그인 필요" });
    }

    const user_idx = user.user_idx;

    try {
        // [1] 유저 닉네임 (users 테이블)
        const [userRows] = await db.query("SELECT nick FROM users WHERE user_idx = ?", [user_idx]);
        
        // [2] 총 포인트 (points 테이블 합산)
        const [pointRows] = await db.query("SELECT IFNULL(SUM(reward_point), 0) as total_points FROM points WHERE user_idx = ?", [user_idx]);
        
        // [3] 이번 달 활동 날짜 (immersions 테이블)
        const [calendarData] = await db.query(`
            SELECT DISTINCT DAY(imm_date) as day 
            FROM immersions 
            WHERE user_idx = ? AND MONTH(imm_date) = MONTH(CURRENT_DATE())
        `, [user_idx]);

        // [4] 최근 7일 통계 (목표 수치는 기획에 따라 리액트에서 처리하거나 고정값 사용)
        const [goalData] = await db.query(`
            SELECT 
                IFNULL(SUM(TIMESTAMPDIFF(SECOND, start_time, end_time))/3600, 0) as weekly_hours,
                IFNULL(AVG(imm_score), 0) as avg_score
            FROM immersions 
            WHERE user_idx = ? AND end_time IS NOT NULL 
              AND imm_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `, [user_idx]);

        // [5] 최근 3개 세션 기록 (immersions 테이블)
        const [recentSessions] = await db.query(`
            SELECT 
                imm_idx as id, 
                DATE_FORMAT(imm_date, '%m월 %d일') as date,
                start_time,
                TIMESTAMPDIFF(MINUTE, start_time, end_time) as duration_min,
                imm_score as score
            FROM immersions 
            WHERE user_idx = ? AND end_time IS NOT NULL
            ORDER BY imm_date DESC, start_time DESC 
            LIMIT 3
        `, [user_idx]);

        res.json({
            success: true,
            data: {
                profile: {
                    name: userRows[0]?.nick,
                    points: pointRows[0].total_points
                    // 🚨 rank 등 가상 데이터 완전 제거
                },
                recordedDays: calendarData.map(d => d.day),
                weekly_stats: {
                    hours: Math.round(goalData[0]?.weekly_hours || 0),
                    avg_score: Math.round(goalData[0]?.avg_score || 0)
                },
                recentSessions: recentSessions.map(s => ({
                    id: s.id,
                    date: `${s.date} ${s.start_time?.substring(0, 5)}`,
                    duration: `${s.duration_min || 0}분`,
                    score: s.score || 0
                }))
            }
        });

    } catch (err) {
        console.error("API 에러:", err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;