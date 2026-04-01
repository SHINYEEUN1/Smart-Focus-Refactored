const db = require('../config/database');

const DEFAULT_NOISE_OBJECT_NAME = 'ambient';
const DEFAULT_NOISE_RELIABILITY = 1;

async function saveNoiseIfNeeded({
  immersionId,
  noiseLevelDb,
  currentTimestampMs,
  lastNoiseSavedAtMs,
  noiseSaveIntervalMs,
}) {
  if (immersionId === undefined || immersionId === null) {
    return {
      saved: false,
      nextNoiseSavedAtMs: lastNoiseSavedAtMs,
      reason: 'IMMERSION_ID_MISSING',
    };
  }

  if (typeof noiseLevelDb !== 'number' || Number.isNaN(noiseLevelDb)) {
    return {
      saved: false,
      nextNoiseSavedAtMs: lastNoiseSavedAtMs,
      reason: 'INVALID_NOISE_VALUE',
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
    [
      immersionId,
      noiseLevelDb,
      DEFAULT_NOISE_OBJECT_NAME,
      DEFAULT_NOISE_RELIABILITY,
    ]
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