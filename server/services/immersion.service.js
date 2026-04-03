const db = require('../config/database');
const geminiService = require('./gemini.service');

const {
  POSTURE_STATUS,
  POSE_TYPE,
  GOOD_POSTURE_STATUS,
} = require('../../shared/constants/posture');

/**
 * 점수 계산 및 보상 지급을 위한 상수 정의
 */
const SCORE_RULE = {
  DEFAULT_SCORE: 100,
  DEFAULT_DECIBEL: 30,
  BAD_POSE_PENALTY: 5,
  MAX_SCORE: 100,
  REWARD_THRESHOLD: 80,
  HIGH_REWARD: 50,
  LOW_REWARD: 10,
};

/**
 * 자세 상태 문자열을 기반으로 기본 자세 타입(GOOD/BAD)을 반환합니다.
 * @param {string} poseStatus - 현재 자세 상태
 * @returns {string} POSE_TYPE.GOOD 또는 POSE_TYPE.BAD
 */
function getPoseTypeFromStatus(poseStatus) {
  return GOOD_POSTURE_STATUS.includes(poseStatus)
    ? POSE_TYPE.GOOD
    : POSE_TYPE.BAD;
}

/**
 * 차트 데이터의 빈 구간(NULL)을 이전 데이터 값으로 채워 연속성을 보장합니다.
 * @param {Array} chartData - DB에서 조회된 원본 차트 데이터
 * @returns {Array} 결측치가 보완된 차트 데이터 배열
 */
function fillChartData(chartData) {
  let lastScore = SCORE_RULE.DEFAULT_SCORE;
  let lastDecibel = SCORE_RULE.DEFAULT_DECIBEL;

  return chartData.map((item) => {
    const filledItem = { ...item };

    if (filledItem.imm_score !== null) {
      lastScore = filledItem.imm_score;
    } else {
      filledItem.imm_score = lastScore;
    }

    if (filledItem.decibel !== null) {
      lastDecibel = filledItem.decibel;
    } else {
      filledItem.decibel = lastDecibel;
    }

    return filledItem;
  });
}

/**
 * 새로운 집중 세션을 DB에 생성합니다.
 * @param {number} userIdx - 사용자 식별자
 * @returns {Promise<number>} 생성된 세션의 고유 식별자(imm_idx)
 */
async function startSession(userIdx) {
  const sql = `
    INSERT INTO immersions (user_idx, imm_date, start_time, imm_score, max_good_streak)
    VALUES (?, CURDATE(), CURTIME(), 0, 0)
  `;

  const [result] = await db.query(sql, [userIdx]);
  return result.insertId;
}

/**
 * 진행 중인 세션의 소음 및 자세 로그 데이터를 저장합니다.
 * @param {Object} params - 로그 데이터 객체 (immIdx, noise, pose 포함)
 */
async function logSessionData({ immIdx, noise, pose }) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('==== [DEBUG] 클라이언트 수신 데이터 ====');
    console.log({ immIdx, noise, pose });
  }

  if (noise) {
    const noiseSql = `
      INSERT INTO noises (imm_idx, decibel, obj_name, reliability, is_summary, detected_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `;

    await db.query(noiseSql, [
      immIdx,
      noise.decibel || 0,
      noise.obj_name || 'none',
      noise.reliability || 0,
    ]);
  }

  if (pose) {
    const poseStatus = pose.pose_status || pose.status || 'NORMAL';
    const poseType = pose.pose_type || getPoseTypeFromStatus(poseStatus);

    if (process.env.NODE_ENV !== 'production') {
      console.log('---- [DEBUG] DB 저장 파라미터 확인 ----');
      console.log('- imm_idx:', immIdx);
      console.log('- poseType:', poseType);
      console.log('- poseStatus:', poseStatus);
    }

    const poseSql = `
      INSERT INTO poses (imm_idx, pose_type, pose_status, count, detected_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
    `;

    await db.query(poseSql, [immIdx, poseType, poseStatus]);
  }
}

/**
 * 세션을 종료하고 최종 점수 산출 및 보상을 지급합니다.
 * 트랜잭션을 적용하여 데이터 정합성을 보장합니다.
 * @param {Object} params - 세션 종료 파라미터 (immIdx, userIdx, immScore)
 */
async function endSession({ immIdx, userIdx, immScore }) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [poseStats] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM poses WHERE imm_idx = ? AND pose_type = ?`,
      [immIdx, POSE_TYPE.BAD]
    );

    const badPoseCount = poseStats[0]?.cnt || 0;

    let finalScore =
      immScore !== undefined
        ? immScore
        : SCORE_RULE.MAX_SCORE - badPoseCount * SCORE_RULE.BAD_POSE_PENALTY;

    finalScore = Math.max(0, finalScore);

    const rewardPoint =
      finalScore >= SCORE_RULE.REWARD_THRESHOLD
        ? SCORE_RULE.HIGH_REWARD
        : SCORE_RULE.LOW_REWARD;

    await conn.query(
      `
        INSERT INTO points (user_idx, reward_type, reward_point, earned_at)
        VALUES (?, '집중 보상', ?, CURRENT_TIMESTAMP)
      `,
      [userIdx, rewardPoint]
    );

    await conn.query(
      `
        UPDATE immersions
        SET end_time = CURTIME(), imm_score = ?
        WHERE imm_idx = ? AND user_idx = ?
      `,
      [finalScore, immIdx, userIdx]
    );

    // 자세 기록 조회
    const [poseSummary] = await conn.query(
      `SELECT pose_status, COUNT(*) AS count
       FROM poses
       WHERE imm_idx = ?
       GROUP BY pose_status`,
      [immIdx]
    );

    // 평균 소음 조회
    const [noiseData] = await conn.query(
      `SELECT AVG(decibel) AS avg_decibel
       FROM noises
       WHERE imm_idx = ?`,
      [immIdx]
    );

    const avgDecibel = Math.round(noiseData[0]?.avg_decibel || 0);

    // 집중 시간 조회
    const [timeData] = await conn.query(
      `SELECT TIMESTAMPDIFF(SECOND, start_time, CURTIME()) AS total_seconds
       FROM immersions
       WHERE imm_idx = ?`,
      [immIdx]
    );

    const totalSeconds = timeData[0]?.total_seconds || 0;

    // Gemini 피드백 생성
    const feedback = await geminiService.generateFeedback({
      totalSeconds,
      immScore: finalScore,
      avgDecibel,
      poseSummary,
    });

    // immersions 테이블에 ai_feedback 저장
    await conn.query(
      `UPDATE immersions 
       SET ai_feedback = ? 
       WHERE imm_idx = ?
      `,
      [JSON.stringify(feedback), immIdx]
    );

    await conn.commit();

    return {
      calculated_score: finalScore,
      earned_points: rewardPoint,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * 특정 세션의 상세 분석 리포트 데이터를 조회하여 병합 반환합니다.
 * 에러 원인이었던 SQL 구문(쉼표 누락)을 수정했습니다.
 * @param {Object} params - 조회할 세션 파라미터 (immIdx, userIdx)
 */
async function getReport({ immIdx, userIdx }) {
  const [sessionInfo] = await db.query(
    `
      SELECT *,
        TIMESTAMPDIFF(
          SECOND,
          CONCAT(imm_date, ' ', start_time),
          IFNULL(CONCAT(imm_date, ' ', end_time), CURRENT_TIMESTAMP)
        ) AS total_seconds
      FROM immersions
      WHERE imm_idx = ? AND user_idx = ?
    `,
    [immIdx, userIdx]
  );

  if (sessionInfo.length === 0) {
    return null;
  }

  /* 세션에 연관된 소음 요약, 자세 요약, 시계열 차트 데이터를 병렬로 조회합니다. */
  const [noiseSummaryResult, poseSummaryResult, chartDataResult] = await Promise.all([
    db.query(
      `
        SELECT
          AVG(decibel) AS avg_decibel,
          (
            SELECT obj_name
            FROM noises
            WHERE imm_idx = ? AND decibel
            GROUP BY obj_name
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) AS main_obstacle
        FROM noises
        WHERE imm_idx = ?
      `,
      [immIdx, immIdx]
    ),
    db.query(
      `
        SELECT pose_status, COUNT(*) AS count
        FROM poses
        WHERE imm_idx = ?
        GROUP BY pose_status
      `,
      [immIdx]
    ),
    db.query(
      `
        SELECT
          time_label,
          MAX(imm_score) AS imm_score,
          MAX(decibel) AS decibel
        FROM (
          SELECT
            DATE_FORMAT(detected_at, '%H:%i:%s') AS time_label,
            CASE
            WHEN pose_type = '${POSE_TYPE.GOOD}' THEN 100
            WHEN pose_type = '${POSE_TYPE.BAD}' THEN 40
            ELSE NULL
            END AS imm_score,
            NULL AS decibel,
            detected_at
          FROM poses
          WHERE imm_idx = ?

          UNION ALL

          SELECT
            DATE_FORMAT(detected_at, '%H:%i:%s') AS time_label,
            NULL AS imm_score,
            decibel,
            detected_at
          FROM noises
          WHERE imm_idx = ?
        ) AS combined_data
        GROUP BY time_label
        ORDER BY MIN(detected_at) ASC
      `,
      [immIdx, immIdx]
    ),
  ]);

  const [noiseSummary] = noiseSummaryResult;
  const [poseSummary] = poseSummaryResult;
  const [chartData] = chartDataResult;

  const filledChartData = fillChartData(chartData);

  return {
    session: sessionInfo[0],
    noise_summary: noiseSummary[0],
    pose_summary: poseSummary,
    chart_data: filledChartData,
  };
}

module.exports = {
  startSession,
  logSessionData,
  endSession,
  getReport,
};