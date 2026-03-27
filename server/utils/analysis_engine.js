/**
 * [Smart Focus] 통합 분석 엔진 (서버)
 * SFEngine.js(클라이언트) 기준과 동일한 임계값 적용
 * - 엎드림: h_offset <= -0.1 (WARNING), <= -0.05 (CAUTION)
 * - 정면 거북목: calibration.distY 필수 (없으면 판정 스킵)
 * - visibility > 0.7 이상 랜드마크만 사용
 * - 턱 괴기: Face Mesh 152번(턱끝) 활용 + faceHeight 비율 기준
 */

// 1. 카메라 위치 및 모드 감지 (어깨 너비 기반)
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

// 3. 사용자 이탈 체크 (주요 랜드마크 visibility > 0.7)
const check_user_presence = (landmarks) => {
    if (!landmarks || landmarks.length < 13) return false;
    const nose = landmarks[0];
    const left_shoulder = landmarks[11];
    const right_shoulder = landmarks[12];
    return (
        nose.visibility > 0.7 &&
        left_shoulder.visibility > 0.7 &&
        right_shoulder.visibility > 0.7
    );
};

/**
 * 4. 세부 자세 분석
 * @param {Array}  landmarks     - MediaPipe Pose 랜드마크
 * @param {String} mode          - detect_camera_mode 결과
 * @param {Object} calibration   - 정자세 기준값 { distY: number }
 * @param {Array}  faceLandmarks - Face Mesh 랜드마크 (선택, 152번 턱끝 활용)
 */
const analyze_posture = (landmarks, mode = 'FRONT_VIEW', calibration = null, faceLandmarks = null) => {
    if (!landmarks || landmarks.length < 17) return 'UNKNOWN';

    const currentMode = mode || 'FRONT_VIEW';

    const nose          = landmarks[0];
    const left_shoulder = landmarks[11];
    const right_shoulder = landmarks[12];
    const left_ear      = landmarks[7];
    const right_ear     = landmarks[8];
    const left_wrist    = landmarks[15];
    const right_wrist   = landmarks[16];

    // 핵심 랜드마크 visibility 체크 — 배경 인물 오인식 방지
    if (
        nose.visibility          < 0.7 ||
        left_shoulder.visibility  < 0.7 ||
        right_shoulder.visibility < 0.7
    ) return 'UNKNOWN';

    const shoulder_y_avg = (left_shoulder.y + right_shoulder.y) / 2;
    // 음수가 클수록(더 마이너스) 엎드림
    const h_offset = nose.y - shoulder_y_avg;
    const s_slope  = Math.abs(left_shoulder.y - right_shoulder.y);

    /**
     * [1] 엎드림 판정 — 두 단계 임계값
     *   WARNING  : h_offset <= -0.1  (머리가 많이 내려간 상태)
     *   CAUTION  : h_offset <= -0.05 (초기 숙임 단계)
     */
    if (h_offset <= -0.1)  return 'SLUMPED';
    if (h_offset <= -0.05) return 'SLUMPED';

    /**
     * [2] 턱 괴기 판정 — Face Mesh 152번(턱끝) 우선 활용
     *   faceHeight 대비 손목↔턱 거리 비율로 판단 (절대 거리보다 스케일에 강함)
     */
    const wristVisible = left_wrist.visibility > 0.7 || right_wrist.visibility > 0.7;
    if (wristVisible) {
        let chinApprox;
        if (faceLandmarks && faceLandmarks[152]) {
            chinApprox = { x: faceLandmarks[152].x, y: faceLandmarks[152].y };
        } else {
            // 폴백: Pose 입꼬리(9, 10) 평균
            chinApprox = {
                x: (landmarks[9].x + landmarks[10].x) / 2,
                y: (landmarks[9].y + landmarks[10].y) / 2,
            };
        }
        const faceHeight = Math.abs(nose.y - chinApprox.y);
        if (faceHeight > 0.001) {
            const distL = Math.sqrt(Math.pow(left_wrist.x - chinApprox.x, 2) + Math.pow(left_wrist.y - chinApprox.y, 2));
            const distR = Math.sqrt(Math.pow(right_wrist.x - chinApprox.x, 2) + Math.pow(right_wrist.y - chinApprox.y, 2));
            const ratio = Math.min(distL, distR) / faceHeight;
            if (ratio < 0.15) return 'LEANING_ON_HAND';
        }
    }

    /**
     * [3] 거북목 판정 (TURTLE_NECK)
     *   측면: 귀-어깨 x축 거리 기준
     *   정면: calibration.distY 필수 — 없으면 판정 스킵
     */
    if (currentMode.startsWith('SIDE')) {
        const ear      = currentMode === 'SIDE_LEFT' ? left_ear  : right_ear;
        const shoulder = currentMode === 'SIDE_LEFT' ? left_shoulder : right_shoulder;
        if (ear.visibility > 0.7) {
            const distX = Math.abs(ear.x - shoulder.x) * 1000;
            if (distX >= 50) return 'TURTLE_NECK';
            if (distX >= 25) return 'TURTLE_NECK';
        }
    } else {
        // 정면: calibration 없으면 판정 불가 (기본값 폴백 제거)
        if (calibration && calibration.distY >= 0.001 && left_ear.visibility > 0.7) {
            const ratio = Math.abs(left_ear.y - left_shoulder.y) / calibration.distY;
            if (ratio <= 0.70) return 'TURTLE_NECK';
            if (ratio <= 0.85) return 'TURTLE_NECK';
        }
    }

    /**
     * [4] 기울어짐 판정 (TILTED)
     */
    if (s_slope >= 0.05) return 'TILTED';
    if (s_slope >= 0.03) return 'TILTED';

    return 'GOOD_POSTURE';
};

/**
 * 5. 맞춤형 코칭 메시지 생성
 */
const get_coaching_message = (posture_status, noise_status) => {
    if (posture_status === 'SLUMPED')          return "자세가 너무 낮아요! 허리를 쭉 펴볼까요?";
    if (posture_status === 'LEANING_ON_HAND') return "턱을 괴면 척추가 휘어질 수 있어요.";
    if (posture_status === 'TURTLE_NECK')     return "목이 앞으로 많이 나왔어요! 어깨를 펴고 고개를 들어주세요.";
    if (posture_status === 'TILTED')          return "몸이 한쪽으로 기울어져 있습니다. 수평을 맞춰보세요.";
    if (noise_status   === 'NOISY')                  return "주변이 조금 시끄럽네요. 이어폰 착용을 추천드려요.";
    return "집중하기 딱 좋은 자세입니다!";
};

module.exports = {
    detect_camera_mode,
    analyze_noise_level,
    check_user_presence,
    analyze_posture,
    get_coaching_message,
};