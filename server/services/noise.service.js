// services/noise.service.js
const db = require('../config/database');

async function saveNoiseIfNeeded({
  immersionId,
  noiseLevelDb,
  currentTimestampMs,
  lastNoiseSavedAtMs,
  noiseSaveIntervalMs,
}) {
  if (!immersionId) {
    return {
      saved: false,
      nextNoiseSavedAtMs: lastNoiseSavedAtMs,
      reason: 'IMMERSION_ID_MISSING',
    };
  }

  if (noiseLevelDb === undefined || noiseLevelDb === null) {
    return {
      saved: false,
      nextNoiseSavedAtMs: lastNoiseSavedAtMs,
      reason: 'NOISE_VALUE_MISSING',
    };
  }

  if (currentTimestampMs - lastNoiseSavedAtMs < noiseSaveIntervalMs) {
    return {
      saved: false,
      nextNoiseSavedAtMs: lastNoiseSavedAtMs,
      reason: 'SAVE_INTERVAL_NOT_REACHED',
    };
  }

  await db.query(
    `
      INSERT INTO noises (imm_idx, decibel, obj_name, reliability, is_summary, detected_at)
      VALUES (?, ?, ?, ?, 0, NOW())
    `,
    [immersionId, noiseLevelDb, 'ambient', 1]
  );

  return {
    saved: true,
    nextNoiseSavedAtMs: currentTimestampMs,
    reason: 'NOISE_SAVED',
  };
}

module.exports = {
  saveNoiseIfNeeded,
};