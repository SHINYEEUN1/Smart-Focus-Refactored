/**
 * 사용자의 포즈 데이터를 바탕으로 카메라 위치(정면/측면)를 감지합니다.
 * @param {Object} landmarks - MediaPipe에서 넘어온 포즈 데이터
 */
const detectCameraMode = (landmarks) => {
    if (!landmarks || landmarks.length === 0) return 'UNKNOWN';

    // 왼쪽 귀와 오른쪽 귀의 가시성(visibility)이나 좌표 차이를 이용
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    // 두 귀가 모두 잘 보이면 '정면', 한쪽만 유독 잘 보이면 '측면'으로 판정
    const earVisibilityDiff = Math.abs(leftEar.visibility - rightEar.visibility);
    
    if (earVisibilityDiff > 0.5) {
        return 'SIDE_VIEW'; // 측면
    } else {
        return 'FRONT_VIEW'; // 정면
    }
};

/**
 * 주변 소음 수치를 분석하여 몰입 방해 요소를 판정합니다.
 * @param {Number} db - 클라이언트에서 측정된 데시벨 값
 */
const analyzeNoiseLevel = (db) => {
    if (db > 70) return 'NOISY';      // 시끄러움 (경고 필요)
    if (db > 40) return 'NORMAL';     // 보통
    return 'QUIET';                   // 몰입하기 좋은 상태
};

/**
 * 예외 처리: 사용자가 카메라 범위를 벗어났을 때
 */
const checkUserPresence = (landmarks) => {
    if (!landmarks || landmarks.length < 11) { // 주요 상체 포인트가 없는 경우
        return false; // 사용자 이탈
    }
    return true;
};

module.exports = { detectCameraMode, analyzeNoiseLevel, checkUserPresence };