const db = require('../config/database');
const geminiService = require('./gemini.service');

const {
  POSTURE_STATUS,
  POSE_TYPE,
  GOOD_POSTURE_STATUS,
} = require('../../shared/constants/posture');

/**
 * 점수 계산 및 보상 지급을 위한 상수 정의
 *
 * - BAD_POSE_PENALTY : 나쁜 자세 1회당 점수 차감량 (클라이언트 점수가 없을 때 서버 계산용)
 * - REWARD_THRESHOLD : 이 점수 이상이면 HIGH_REWARD, 미만이면 LOW_REWARD 지급
 * - HIGH/LOW_REWARD  : 포인트 스토어 기능과 연동되는 보상 포인트 (기획 결정값)
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
 * Forward-fill 방식을 선택한 이유:
 * 소음·자세 데이터가 일정 간격으로 저장되지 않아 시간축에 빈 구간이 생길 수 있음.
 * 이를 0으로 채우면 차트가 급격히 꺾이므로 직전 값으로 채워 부드러운 연속성을 유지.
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
 * 소켓 실시간 저장 실패 시 클라이언트가 직접 이 API를 호출하는 fallback 경로임.
 * pose_status와 status 두 필드를 모두 허용하는 이유:
 * 초기 클라이언트 버전과의 하위 호환성 유지를 위해 두 필드명을 모두 처리.
 * @param {Object} params - 로그 데이터 객체 (immIdx, noise, pose 포함)
 */
async function logSessionData({ immIdx, noise, pose }) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[logSessionData] 클라이언트 수신 데이터:', { immIdx, noise, pose });
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
    // pose_status와 status 둘 다 허용 (클라이언트 버전 하위 호환)
    const poseStatus = pose.pose_status || pose.status || 'NORMAL';
    const poseType = pose.pose_type || getPoseTypeFromStatus(poseStatus);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[logSessionData] DB 저장 파라미터:', { immIdx, poseType, poseStatus });
    }

    const poseSql = `
      INSERT INTO poses (imm_idx, pose_type, pose_status, count, detected_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
    `;

    await db.query(poseSql, [immIdx, poseType, poseStatus]);
  }
}

// ─── endSession 서브 함수 ──────────────────────────────────────────────────────

/**
 * 최종 집중 점수를 계산합니다.
 * 클라이언트에서 이미 계산된 점수(immScore)가 있으면 그것을 우선 사용하고,
 * 없으면 나쁜 자세 횟수 기반으로 서버가 직접 계산합니다.
 * 클라이언트 점수를 우선하는 이유:
 * 실시간으로 누적된 점수가 자세 횟수 기반 단순 계산보다 더 세밀하고 정확함.
 * @param {Object} conn     - DB 트랜잭션 커넥션
 * @param {number} immIdx   - 세션 식별자
 * @param {number} immScore - 클라이언트에서 전달된 점수 (undefined이면 서버 계산)
 * @returns {Promise<number>} 0~100 범위의 최종 점수
 */
async function calculateFinalScore(conn, immIdx, immScore) {
  if (immScore !== undefined) {
    return Math.max(0, immScore);
  }

  const [poseStats] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM poses WHERE imm_idx = ? AND pose_type = ?`,
    [immIdx, POSE_TYPE.BAD]
  );
  const badPoseCount = poseStats[0]?.cnt || 0;
  return Math.max(0, SCORE_RULE.MAX_SCORE - badPoseCount * SCORE_RULE.BAD_POSE_PENALTY);
}

/**
 * 세션 데이터를 조회하고 Gemini AI 피드백을 생성합니다.
 * 자세 기록, 소음 평균, 집중 시간을 순차적으로 조회한 뒤 Gemini에 전달.
 * (같은 트랜잭션 커넥션을 사용하므로 병렬 쿼리 대신 순차 처리)
 * @param {Object} conn      - DB 트랜잭션 커넥션
 * @param {number} immIdx    - 세션 식별자
 * @param {number} finalScore - 최종 계산된 집중 점수
 * @returns {Promise<Object>} Gemini AI 피드백 객체
 */
async function generateSessionFeedback(conn, immIdx, finalScore) {
  const [poseSummary] = await conn.query(
    `SELECT pose_status, COUNT(*) AS count FROM poses WHERE imm_idx = ? GROUP BY pose_status`,
    [immIdx]
  );
  const [noiseData] = await conn.query(
    `SELECT AVG(decibel) AS avg_decibel FROM noises WHERE imm_idx = ?`,
    [immIdx]
  );
  const [timeData] = await conn.query(
    `SELECT TIMESTAMPDIFF(SECOND, start_time, CURTIME()) AS total_seconds FROM immersions WHERE imm_idx = ?`,
    [immIdx]
  );

  const avgDecibel = Math.round(noiseData[0]?.avg_decibel || 0);
  const totalSeconds = timeData[0]?.total_seconds || 0;

  return geminiService.generateFeedback({
    totalSeconds,
    immScore: finalScore,
    avgDecibel,
    poseSummary,
  });
}

/**
 * 집중 보상 포인트를 지급하고 뱃지 자동 부여를 처리합니다.
 *
 * [뱃지 배치 INSERT 사용 이유]
 * 기존: 뱃지 N개 → user_badges INSERT N번 + points INSERT N번 = DB 왕복 N*2번
 * 개선: 뱃지 N개 → user_badges 배치 INSERT 1번 + points 배치 INSERT 1번 = DB 왕복 2번
 * 트랜잭션 내에서 DB 왕복 횟수를 최소화해 잠금 유지 시간을 줄임.
 *
 * [포인트 조회 순서]
 * 보상 포인트 INSERT 후 pointSum을 조회해야 방금 적립한 포인트가 합계에 포함됨.
 * reward_point 음수(뱃지 차감)도 SUM에 반영되므로 실제 잔여 포인트가 됨.
 *
 * @param {Object} conn      - DB 트랜잭션 커넥션
 * @param {number} userIdx   - 사용자 식별자
 * @param {number} finalScore - 최종 집중 점수
 * @returns {Promise<{ rewardPoint: number, newBadges: Array|null }>}
 */
async function grantPointsAndBadges(conn, userIdx, finalScore) {
  const rewardPoint = finalScore >= SCORE_RULE.REWARD_THRESHOLD
    ? SCORE_RULE.HIGH_REWARD
    : SCORE_RULE.LOW_REWARD;

  // 보상 포인트 먼저 INSERT — 이후 pointSum 조회 시 이 값이 합계에 포함되어야 함
  await conn.query(
    `INSERT INTO points (user_idx, reward_type, reward_point, earned_at) VALUES (?, '집중 보상', ?, CURRENT_TIMESTAMP)`,
    [userIdx, rewardPoint]
  );

  // 현재까지 적립된 포인트 합계 조회 (방금 적립한 보상 포함)
  const [pointSum] = await conn.query(
    `SELECT IFNULL(SUM(reward_point), 0) AS total FROM points WHERE user_idx = ?`,
    [userIdx]
  );
  const totalPoints = pointSum[0].total;

  // 획득 가능한 뱃지 조회
  // 조건 1: badge_point <= 현재 보유 포인트
  // 조건 2: 아직 받지 않은 뱃지 (중복 수령 방지)
  // ORDER BY badge_point ASC: 낮은 포인트 뱃지부터 순서대로 부여
  const [availableBadges] = await conn.query(
    `SELECT * FROM badges
     WHERE badge_point <= ?
       AND badge_idx NOT IN (SELECT badge_idx FROM user_badges WHERE user_idx = ?)
     ORDER BY badge_point ASC`,
    [totalPoints, userIdx]
  );

  if (availableBadges.length > 0) {
    const now = new Date();
    // 배치 INSERT: 뱃지 N개를 쿼리 1번으로 처리
    const badgeRows = availableBadges.map(b => [userIdx, b.badge_idx, now]);
    const pointRows = availableBadges.map(b => [userIdx, '뱃지 차감', -b.badge_point, now]);

    await conn.query(
      `INSERT INTO user_badges (user_idx, badge_idx, created_at) VALUES ?`,
      [badgeRows]
    );
    await conn.query(
      `INSERT INTO points (user_idx, reward_type, reward_point, earned_at) VALUES ?`,
      [pointRows]
    );
  }

  return {
    rewardPoint,
    newBadges: availableBadges.length > 0 ? availableBadges : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 세션을 종료하고 최종 점수 산출 및 보상을 지급합니다.
 * 트랜잭션을 적용하여 점수·포인트·뱃지·AI 피드백이 모두 저장되거나 모두 롤백되도록 보장.
 *
 * [처리 순서]
 * 1. 최종 점수 계산 (클라이언트 점수 우선, 없으면 서버 계산)
 * 2. 세션 종료 시각 및 점수 저장
 * 3. AI 피드백 생성 (Gemini 호출)
 * 4. 보상 포인트 지급 및 뱃지 자동 부여
 * 5. AI 피드백 저장
 *
 * @param {Object} params - 세션 종료 파라미터 (immIdx, userIdx, immScore)
 */
async function endSession({ immIdx, userIdx, immScore }) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const finalScore = await calculateFinalScore(conn, immIdx, immScore);

    // 세션 종료 시각과 최종 점수를 먼저 저장
    // (generateSessionFeedback의 CURTIME() 기반 집중 시간 계산이 이 시점 기준으로 측정됨)
    await conn.query(
      `UPDATE immersions SET end_time = CURTIME(), imm_score = ? WHERE imm_idx = ? AND user_idx = ?`,
      [finalScore, immIdx, userIdx]
    );

    const feedback = await generateSessionFeedback(conn, immIdx, finalScore);
    const { rewardPoint, newBadges } = await grantPointsAndBadges(conn, userIdx, finalScore);

    await conn.query(
      `UPDATE immersions SET ai_feedback = ? WHERE imm_idx = ?`,
      [JSON.stringify(feedback), immIdx]
    );

    await conn.commit();

    return {
      calculated_score: finalScore,
      earned_points: rewardPoint,
      new_badges: newBadges,
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
