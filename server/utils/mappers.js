// utils/mappers.js
const {
  GOOD_POSTURE_STATUS,
  POSE_TYPE,
} = require('../../shared/constants/posture');


const DEFAULT_POSTURE_SCORE = 100;

const POSTURE_SCORE_RULES = [
  { keyword: 'TURTLE_NECK', score: 80 },
  { keyword: 'SLUMPED', score: 40 },
  { keyword: 'LEANING_ON_HAND', score: 60 },
  { keyword: 'TILTED', score: 70 },
  { keyword: 'STATIC', score: 50 },
  { keyword: 'DROWSY', score: 30 },
];

const GOOD_POSTURE_STATUS_SET = new Set(GOOD_POSTURE_STATUS);

const SOCKET_INTERVALS = {
  ANALYSIS_DISPATCH_MS: 1000,
  NOISE_SAVE_MS: 5000,
};

function getDisplayScore(postureStatus) {
  if (typeof postureStatus !== 'string' || postureStatus.length === 0) {
    return DEFAULT_POSTURE_SCORE;
  }

  const matchedRule = POSTURE_SCORE_RULES.find(({ keyword }) =>
    postureStatus.includes(keyword)
  );

  return matchedRule ? matchedRule.score : DEFAULT_POSTURE_SCORE;
}

function getPoseType(postureStatus) {
  return GOOD_POSTURE_STATUS_SET.has(postureStatus)
    ? POSE_TYPE.GOOD
    : POSE_TYPE.BAD;
}

module.exports = {
  DEFAULT_POSTURE_SCORE,
  POSTURE_SCORE_RULES,
  GOOD_POSTURE_STATUS_SET,
  SOCKET_INTERVALS,
  getDisplayScore,
  getPoseType,
};