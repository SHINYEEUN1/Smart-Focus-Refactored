/**
 * 1. 카메라 위치 감지 (정면/측면)
 */
const detect_camera_mode = (landmarks) => {
    if (!landmarks || landmarks.length === 0) return 'UNKNOWN';
    const left_ear = landmarks[7];
    const right_ear = landmarks[8];
    const ear_visibility_diff = Math.abs(left_ear.visibility - right_ear.visibility);
    
    return ear_visibility_diff > 0.5 ? 'SIDE_VIEW' : 'FRONT_VIEW';
};

/**
 * 2. 주변 소음 분석
 */
const analyze_noise_level = (db) => {
    if (db > 70) return 'NOISY';
    if (db > 40) return 'NORMAL';
    return 'QUIET';
};

/**
 * 3. 사용자 이탈 체크
 */
const check_user_presence = (landmarks) => {
    return !(!landmarks || landmarks.length < 11);
};

/**
 * 4. 세부 자세 분석 (턱 괴기, 엎드림 등)
 */
const analyze_posture = (landmarks) => {
    if (!landmarks || landmarks.length < 11) return 'UNKNOWN';

    const nose = landmarks[0];
    const left_shoulder = landmarks[11];
    const right_shoulder = landmarks[12];
    const left_wrist = landmarks[15];
    const right_wrist = landmarks[16];

    const shoulder_y = (left_shoulder.y + right_shoulder.y) / 2;
    if (nose.y > shoulder_y) return 'SLUMPED';

    const dist_left = Math.sqrt(Math.pow(nose.x - left_wrist.x, 2) + Math.pow(nose.y - left_wrist.y, 2));
    const dist_right = Math.sqrt(Math.pow(nose.x - right_wrist.x, 2) + Math.pow(nose.y - right_wrist.y, 2));
    
    if (dist_left < 0.12 || dist_right < 0.12) return 'LEANING_ON_HAND';

    return 'GOOD_POSTURE';
};

/**
 * 5. 맞춤형 코칭 메시지 생성
 */
const get_coaching_message = (posture_status, noise_status) => {
    if (posture_status === 'SLUMPED') return "자세가 너무 낮아요! 허리를 쭉 펴볼까요?";
    if (posture_status === 'LEANING_ON_HAND') return "턱을 괴면 척추가 휘어질 수 있어요.";
    if (noise_status === 'NOISY') return "주변이 조금 시끄럽네요. 이어폰 착용을 추천드려요.";
    return "집중하기 딱 좋은 자세입니다!";
};

module.exports = { 
    detect_camera_mode, 
    analyze_noise_level, 
    check_user_presence, 
    analyze_posture, 
    get_coaching_message 
};