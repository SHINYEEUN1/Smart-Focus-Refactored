/**
 * [Smart Focus] 통합 분석 엔진
 * Logic: SF.txt 기반 (거북목 하중 및 임계값 반영)
 * Update: TypeError 방지 및 정자세 판정 범위 완화 적용
 */

// 1. 카메라 위치 및 모드 감지 (어깨 너비 기반)
const detect_camera_mode = (landmarks) => {
    if (!landmarks || landmarks.length < 13) return 'FRONT_VIEW';
    const left_shoulder = landmarks[11];
    const right_shoulder = landmarks[12];
    
    // 두 어깨 사이의 유클리드 거리 (정규화 좌표 기준)
    const offset = Math.sqrt(
        Math.pow(left_shoulder.x - right_shoulder.x, 2) +
        Math.pow(left_shoulder.y - right_shoulder.y, 2)
    );

    // offset < 0.15 이면 측면으로 판단 (SF.txt 기준)
    if (offset < 0.15) {
        return left_shoulder.x > right_shoulder.x ? 'SIDE_RIGHT' : 'SIDE_LEFT';
    }
    return 'FRONT_VIEW';
};

// 2. 주변 소음 분석
const analyze_noise_level = (db) => {
    if (db >= 70) return 'NOISY';
    if (db >= 50) return 'NORMAL';
    return 'QUIET';
};

// 3. 사용자 이탈 체크
const check_user_presence = (landmarks) => {
    return !!(landmarks && landmarks.length >= 11 && landmarks[0].visibility > 0.5);
};

/**
 * 4. 세부 자세 분석
 * @param {Array} landmarks - MediaPipe 결과
 * @param {String} mode - detect_camera_mode 결과
 * @param {Object} calibration - 정자세 기준값 (기본값 0.2)
 */
const analyze_posture = (landmarks, mode = 'FRONT_VIEW', calibration = { distY: 0.2 }) => {
    // 안전장치: 데이터가 불완전하면 분석 중단
    if (!landmarks || landmarks.length < 13) return 'UNKNOWN';

    // TypeError 방지: mode가 비어있을 경우 기본값 할당
    const currentMode = mode || 'FRONT_VIEW';

    const nose = landmarks[0];
    const left_shoulder = landmarks[11];
    const right_shoulder = landmarks[12];
    const left_ear = landmarks[7];
    const right_ear = landmarks[8];
    const left_wrist = landmarks[15];
    const right_wrist = landmarks[16];

    // 어깨 중앙 높이 계산
    const shoulder_y_avg = (left_shoulder.y + right_shoulder.y) / 2;
    
    // 머리(코)와 어깨선 사이의 수직 거리 (h_offset이 클수록 코가 낮음)
    const h_offset = nose.y - shoulder_y_avg; 
    const s_slope = Math.abs(left_shoulder.y - right_shoulder.y);

    /**
     * [1] 엎드림 판정 (SLUMPED)
     * 정자세 오판을 막기 위해 기준을 완화함 (코가 어깨선에 거의 닿을 때만 판정)
     */
    if (h_offset > -0.01) return 'SLUMPED';

    /**
     * [2] 턱 괴기 판정 (LEANING_ON_HAND)
     */
    const dist_left = Math.sqrt(Math.pow(nose.x - left_wrist.x, 2) + Math.pow(nose.y - left_wrist.y, 2));
    const dist_right = Math.sqrt(Math.pow(nose.x - right_wrist.x, 2) + Math.pow(nose.y - right_wrist.y, 2));
    if (dist_left < 0.10 || dist_right < 0.10) return 'LEANING_ON_HAND';

    /**
     * [3] 거북목 판정 (TURTLE_NECK)
     * 정면 모드에서 ratio(비율) 기준을 0.75로 낮춰 정자세 유지력을 높임
     */
    if (currentMode.startsWith('SIDE')) {
        const ear = currentMode === 'SIDE_LEFT' ? left_ear : right_ear;
        const shoulder = currentMode === 'SIDE_LEFT' ? left_shoulder : right_shoulder;
        const distX = Math.abs(ear.x - shoulder.x) * 1000;
        if (distX >= 35) return 'TURTLE_NECK'; 
    } else {
        const current_dist_y = Math.abs(left_ear.y - left_shoulder.y);
        const baseDistY = calibration?.distY || 0.2; 
        const ratio = current_dist_y / baseDistY;
        if (ratio <= 0.70) return 'TURTLE_NECK'; // 30% 이상 목이 짧아졌을 때만 경고
    }

    /**
     * [4] 기울어짐 판정 (TILTED)
     */
    if (s_slope >= 0.06) return 'TILTED';

    return 'GOOD_POSTURE';
};

/**
 * 5. 맞춤형 코칭 메시지 생성 (간결한 버전)
 */
const get_coaching_message = (posture_status, noise_status) => {
    // 1순위: 심각한 자세 이상
    if (posture_status === 'SLUMPED') return "자세가 너무 낮아요! 허리를 쭉 펴볼까요?";
    if (posture_status === 'LEANING_ON_HAND') return "턱을 괴면 척추가 휘어질 수 있어요.";

    // 2순위: 거북목 및 비대칭
    if (posture_status === 'TURTLE_NECK') return "목이 앞으로 많이 나왔어요! 어깨를 펴고 고개를 들어주세요.";
    if (posture_status === 'TILTED') return "몸이 한쪽으로 기울어져 있습니다. 수평을 맞춰보세요.";

    // 3순위: 환경 소음
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