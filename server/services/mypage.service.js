const db = require('../config/database');
const { POSE_TYPE } = require('../../shared/constants/posture');

function formatStudyTime(totalSeconds) {
  const total = Number(totalSeconds) || 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return hours > 0
    ? `${hours}시간 ${minutes}분 ${seconds}초`
    : `${minutes}분 ${seconds}초`;
}

async function getStats(userIdx) {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM immersions WHERE user_idx = ?) AS total_sessions,
      (SELECT IFNULL(SUM(reward_point), 0) FROM points WHERE user_idx = ?) AS total_points,
      (SELECT COUNT(*) FROM user_badges WHERE user_idx = ?) AS badge_count,
      IFNULL(SUM(TIMESTAMPDIFF(SECOND, start_time, end_time)), 0) AS total_seconds,
      (
        SELECT IFNULL(AVG(CASE WHEN p.pose_type = '${POSE_TYPE.GOOD}' THEN 100 ELSE 40 END), 0)
        FROM poses p
        JOIN immersions i_sub ON p.imm_idx = i_sub.imm_idx
        WHERE i_sub.user_idx = ?
      ) AS avg_score
    FROM immersions
    WHERE user_idx = ? AND end_time IS NOT NULL
  `;

  const params = [userIdx, userIdx, userIdx, userIdx, userIdx];
  const [stats] = await db.query(sql, params);
  const row = stats[0];

  return {
    ...row,
    avg_score: Number(Number(row.avg_score).toFixed(1)),
    formatted_time: formatStudyTime(row.total_seconds),
  };
}

async function getHistory(userIdx) {
  const sql = `
    SELECT 
      i.imm_idx,
      i.imm_date,
      i.start_time,
      i.end_time,
      (
        SELECT IFNULL(AVG(CASE WHEN p.pose_type = '${POSE_TYPE.GOOD}' THEN 100 ELSE 40 END), 0)
        FROM poses p
        WHERE p.imm_idx = i.imm_idx
      ) AS imm_score,
      (
        SELECT COUNT(*)
        FROM poses p
        WHERE p.imm_idx = i.imm_idx
      ) AS pose_count
    FROM immersions i
    WHERE i.user_idx = ? AND i.end_time IS NOT NULL
    ORDER BY i.imm_date DESC, i.start_time DESC
    LIMIT 20
  `;

  const [history] = await db.query(sql, [userIdx]);

  return history.map((item) => ({
    ...item,
    imm_score: Number(Number(item.imm_score).toFixed(1)),
  }));
}

module.exports = {
  getStats,
  getHistory,
};