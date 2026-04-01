const db = require('../config/database');
const { getPoseType } = require('../utils/mappers');


async function savePoseIfChanged({
  immersionId,
  finalPosture,
  lastSavedPostureStatus,
}) {
  if (immersionId === undefined || immersionId === null) {
    return {
      saved: false,
      nextSavedStatus: lastSavedPostureStatus,
      reason: 'IMMERSION_ID_MISSING',
    };
  }

  if (typeof finalPosture !== 'string' || finalPosture.length === 0) {
    return {
      saved: false,
      nextSavedStatus: lastSavedPostureStatus,
      reason: 'INVALID_POSTURE_STATUS',
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