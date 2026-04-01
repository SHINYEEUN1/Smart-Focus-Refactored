// services/pose.service.js
const db = require('../config/database');
const { getPoseType } = require('../utils/mappers');

async function savePoseIfChanged({
  immersionId,
  finalPosture,
  lastSavedPostureStatus,
}) {
  if (!immersionId) {
    return {
      saved: false,
      nextSavedStatus: lastSavedPostureStatus,
      reason: 'IMMERSION_ID_MISSING',
    };
  }

  if (finalPosture === lastSavedPostureStatus) {
    return {
      saved: false,
      nextSavedStatus: lastSavedPostureStatus,
      reason: 'POSTURE_NOT_CHANGED',
    };
  }

  const poseType = getPoseType(finalPosture);

  await db.query(
    `
      INSERT INTO poses (imm_idx, pose_type, pose_status, count, detected_at)
      VALUES (?, ?, ?, 1, NOW())
    `,
    [immersionId, poseType, finalPosture]
  );

  return {
    saved: true,
    nextSavedStatus: finalPosture,
    reason: 'POSE_SAVED',
  };
}

module.exports = {
  savePoseIfChanged,
};