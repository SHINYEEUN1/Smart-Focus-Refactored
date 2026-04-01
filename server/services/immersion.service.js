const db = require('../config/database');
const {
  POSTURE_STATUS,
  POSE_TYPE,
  GOOD_POSTURE_STATUS,
} = require('../../shared/constants/posture');

const SCORE_RULE = {
  DEFAULT_SCORE: 100,
  DEFAULT_DECIBEL: 30,
  BAD_POSE_PENALTY: 5,
  MAX_SCORE: 100,
  REWARD_THRESHOLD: 80,
  HIGH_REWARD: 50,
  LOW_REWARD: 10,
};

function getPoseTypeFromStatus(poseStatus) {
  return GOOD_POSTURE_STATUS.includes(poseStatus)
    ? POSE_TYPE.GOOD
    : POSE_TYPE.BAD;
}

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

async function startSession(userIdx) {
  const sql = `
    INSERT INTO immersions (user_idx, imm_date, start_time, imm_score, max_good_streak)
    VALUES (?, CURDATE(), CURTIME(), 0, 0)
  `;

  const [result] = await db.query(sql, [userIdx]);
  return result.insertId;
}

async function logSessionData({ immIdx, noise, pose }) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('==== [DEBUG] 리액트에서 받은 원본 데이터 ====');
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
      console.log('---- [DEBUG] DB 저장 직전 변수 상태 ----');
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
            END AS imm_score
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