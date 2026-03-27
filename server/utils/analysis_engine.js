/**
 * [Smart Focus] 통합 분석 엔진 (최종 수정 완료)
 */

// 1. 카메라 위치 및 모드 감지
const detect_camera_mode = (landmarks) => {
    if (!landmarks || landmarks.length < 13) return 'FRONT_VIEW';
    const left_shoulder = landmarks[11];
    const right_shoulder = landmarks[12];
    const offset = Math.sqrt(
        Math.pow(left_shoulder.x - right_shoulder.x, 2) +
        Math.pow(left_shoulder.y - right_shoulder.y, 2)
    );
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

/**
 * 3. 사용자 이탈 체크 (누락되었던 함수 추가)
 * 코(0번) 데이터의 가시성(visibility)을 통해 사용자가 화면에 있는지 판단합니다.
 */
const check_user_presence = (landmarks) => {
    return !!(landmarks && landmarks.length >= 11 && landmarks[0].visibility > 0.5);
};

/**
 * 4. 졸음 감지 (faceLandmarks 활용)
 */
const check_drowsiness = (faceLandmarks) => {
    if (!faceLandmarks || faceLandmarks.length < 468) return false;
    const top = faceLandmarks[159].y;
    const bottom = faceLandmarks[145].y;
    const eye_dist = Math.abs(top - bottom);
    return eye_dist < 0.015; 
};

/**
 * 5. 세부 자세 분석
 */
const analyze_posture = (landmarks, mode = 'FRONT_VIEW', calibration = { distY: 0.2 }, faceLandmarks = null) => {
    if (!landmarks || landmarks.length < 13) return 'UNKNOWN';

    if (faceLandmarks && check_drowsiness(faceLandmarks)) return 'DROWSY';

    const currentMode = mode || 'FRONT_VIEW';
    const nose = landmarks[0];
    const left_shoulder = landmarks[11];
    const right_shoulder = landmarks[12];
    const left_ear = landmarks[7];
    const right_ear = landmarks[8];
    const left_wrist = landmarks[15];
    const right_wrist = landmarks[16];

    const shoulder_y_avg = (left_shoulder.y + right_shoulder.y) / 2;
    const h_offset = nose.y - shoulder_y_avg; 
    const s_slope = Math.abs(left_shoulder.y - right_shoulder.y);

    if (h_offset > -0.01) return 'SLUMPED';

    const dist_left = Math.sqrt(Math.pow(nose.x - left_wrist.x, 2) + Math.pow(nose.y - left_wrist.y, 2));
    const dist_right = Math.sqrt(Math.pow(nose.x - right_wrist.x, 2) + Math.pow(nose.y - right_wrist.y, 2));
    if (dist_left < 0.10 || dist_right < 0.10) return 'LEANING_ON_HAND';

    if (currentMode.startsWith('SIDE')) {
        const ear = currentMode === 'SIDE_LEFT' ? left_ear : right_ear;
        const shoulder = currentMode === 'SIDE_LEFT' ? left_shoulder : right_shoulder;
        const distX = Math.abs(ear.x - shoulder.x) * 1000;
        if (distX >= 35) return 'TURTLE_NECK'; 
    } else {
        const current_dist_y = Math.abs(left_ear.y - left_shoulder.y);
        const baseDistY = calibration?.distY || 0.2; 
        const ratio = current_dist_y / baseDistY;
        if (ratio <= 0.70) return 'TURTLE_NECK';
    }

    if (s_slope >= 0.06) return 'TILTED';

    return 'GOOD_POSTURE';
};

/**
 * 6. 코칭 메시지
 */
const get_coaching_message = (posture_status, noise_status) => {
    if (posture_status === 'DROWSY') return "졸음이 쏟아지고 있어요! 잠시 스트레칭 어때요?";
    if (posture_status === 'SLUMPED') return "자세가 너무 낮아요! 허리를 쭉 펴볼까요?";
    if (posture_status === 'LEANING_ON_HAND') return "턱을 괴면 척추가 휘어질 수 있어요.";
    if (posture_status === 'TURTLE_NECK') return "목이 앞으로 나왔어요! 어깨를 펴고 고개를 들어주세요.";
    if (posture_status === 'TILTED') return "몸이 한쪽으로 기울어져 있습니다.";
    if (noise_status === 'NOISY') return "주변이 시끄럽네요. 이어폰 사용을 추천해요.";

    return "집중하기 딱 좋은 자세입니다!";
};

module.exports = { 
    detect_camera_mode, 
    analyze_noise_level,
    check_user_presence,
    analyze_posture, 
    get_coaching_message
};