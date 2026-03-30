/**
 * [Smart Focus] 통합 분석 엔진 (서버)
 * SFEngine.js(클라이언트) 기준과 동일한 임계값 적용
 * - 엎드림: h_offset >= 0.1 (WARNING), >= 0.05 (CAUTION)
 * - 정면 거북목: calibration.distY 필수 (없으면 판정 스킵)
 * - visibility > 0.7 이상 랜드마크만 사용
 * - 턱 괴기: Face Mesh 152번(턱끝) 활용 + faceHeight 비율 기준
 */

// 0. 부동 자세 추적을 위한 상태 변수
let lastNosePos = null;
let staticCheckStart = Date.now();

const reset_static_tracking = () => {
    lastNosePos = null;
    staticCheckStart = Date.now();
}
// 세션 초기화 함수

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

    const nose = landmarks[0];
    const left_shoulder = landmarks[11];
    const right_shoulder = landmarks[12];
    const left_ear = landmarks[7];
    const right_ear = landmarks[8];
    const left_wrist = landmarks[15];
    const right_wrist = landmarks[16];
    const left_pinky = landmarks[17]; // 새끼손가락 쪽
    const right_pinky = landmarks[18];
    const left_index = landmarks[19]; // 검지손가락 쪽
    const right_index = landmarks[20];

    /**
     * 🔥 [추가] 부동 자세 판정 (STATIC) - 가장 먼저 검사
     * 세부 자세를 보기 전에 "너무 오래 얼음 상태인지"를 먼저 체크합니다.
     */
    const now = Date.now();
    const staticTime = now - staticCheckStart; // 파일 상단에 선언한 변수 사용

    if (staticTime >= 1200000) { // 20분 이상 경과 시
        const move = lastNosePos 
            ? Math.sqrt(Math.pow(nose.x - lastNosePos.x, 2) + Math.pow(nose.y - lastNosePos.y, 2))
            : 1;

        if (move < 0.05) { // 5% 미만 이동 시 (가만히 있음)
            if (staticTime >= 1800000) return 'STATIC_WARNING'; // 30분 경과
            return 'STATIC_CAUTION'; // 20분 경과
        } else {
            // 크게 움직였다면 타이머와 위치 리셋
            lastNosePos = { x: nose.x, y: nose.y };
            staticCheckStart = now;
        }
    }

    // 핵심 랜드마크 visibility 체크 — 배경 인물 오인식 방지
    if (
        nose.visibility < 0.5 ||
        left_shoulder.visibility < 0.5 ||
        right_shoulder.visibility < 0.5
    ) return 'UNKNOWN';

    const shoulder_y_avg = (left_shoulder.y + right_shoulder.y) / 2;
    // 음수가 클수록(더 마이너스) 엎드림
    const h_offset = nose.y - shoulder_y_avg;
    const s_slope = Math.abs(left_shoulder.y - right_shoulder.y);

    /**
     * [1] 턱 괴기 판정 — Face Mesh 152번(턱끝) 우선 활용
     *   faceHeight 대비 손목↔턱 거리 비율로 판단 (절대 거리보다 스케일에 강함)
     */
    /**
     * [우선순위 1] 턱 괴기 판정 (LEANING_ON_HAND)
     * 거북목이나 엎드림보다 먼저 검사하여 '손이 얼굴에 닿는 행위'를 최우선으로 잡습니다.
    */
    // 1. 손목(15,16), 손날(17,18), 검지뿌리(19,20) 중 하나라도 화면에 보이면 판정 시작
    const handVisible = left_wrist.visibility > 0.3 || right_wrist.visibility > 0.3 ||
        left_index.visibility > 0.3 || right_index.visibility > 0.3;

    if (handVisible) {
        let chinPoint;
        // Face Mesh 데이터가 있다면 가장 정확한 턱끝(152번) 좌표를 사용합니다.
        if (faceLandmarks && faceLandmarks[152]) {
            chinPoint = { x: faceLandmarks[152].x, y: faceLandmarks[152].y };
        } else {
            // Face Mesh가 없으면 입꼬리(9, 10번)의 중간 지점을 턱 근처로 가정합니다. (폴백)
            chinPoint = {
                x: (landmarks[9].x + landmarks[10].x) / 2,
                y: (landmarks[9].y + landmarks[10].y) / 2,
            };
        }

        // 얼굴 크기(코~턱 거리)를 구해서, 멀리 있는 손과 가까이 있는 손을 구분하는 기준(Scale)으로 씁니다.
        const faceHeight = Math.abs(nose.y - chinPoint.y);

        if (faceHeight > 0.001) {
            // [핵심] 왼쪽 손의 3개 포인트(손목, 손날, 검지) 중 턱과 가장 가까운 거리를 찾습니다.
            const distL = Math.min(
                Math.sqrt(Math.pow(left_wrist.x - chinPoint.x, 2) + Math.pow(left_wrist.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(left_pinky.x - chinPoint.x, 2) + Math.pow(left_pinky.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(left_index.x - chinPoint.x, 2) + Math.pow(left_index.y - chinPoint.y, 2))
            );

            // 오른쪽 손도 동일하게 가장 가까운 거리를 찾습니다.
            const distR = Math.min(
                Math.sqrt(Math.pow(right_wrist.x - chinPoint.x, 2) + Math.pow(right_wrist.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(right_pinky.x - chinPoint.x, 2) + Math.pow(right_pinky.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(right_index.x - chinPoint.x, 2) + Math.pow(right_index.y - chinPoint.y, 2))
            );

            // 양손 중 더 가까운 쪽의 비율을 계산합니다.
            const ratio = Math.min(distL, distR) / faceHeight;

            // 손바닥이 얼굴(뺨/턱)에 닿으면 보통 이 비율이 0.45 이하로 떨어집니다.
            // 이 조건이 맞으면 거북목 로직으로 넘어가기 전에 즉시 결과를 반환합니다.
            if (ratio < 0.45) return 'LEANING_ON_HAND';
        }
    }

    /**
     * [2] 기울어짐 판정 (TILTED)
    */
    if (s_slope >= 0.1) return 'TILTED_WARNING'; // 경고
    if (s_slope >= 0.06) return 'TILTED_CAUTION'; // 주의
    
    /**
     * [3] 엎드림 판정 — 두 단계 임계값 (턱 괴기가 아니면 여기로 내려옴)
     *   WARNING  : h_offset >= 0.1  (머리가 많이 내려간 상태)
     *   CAUTION  : h_offset >= 0.05 (초기 숙임 단계)
    */
   if (h_offset >= 0.1) return 'SLUMPED_WARNING';
   if (h_offset >= 0.05) return 'SLUMPED_CAUTION';
   
   
    /**
     * [4] 거북목 판정 (TURTLE_NECK)
     *   측면: 귀-어깨 x축 거리 기준
     *   정면: 코의 Y축 픽셀 변화량 (비율 방식 currentNoseToShoulder 삭제)
     */
    if (currentMode.startsWith('SIDE')) {
        const ear = currentMode === 'SIDE_LEFT' ? left_ear : right_ear;
        const shoulder = currentMode === 'SIDE_LEFT' ? left_shoulder : right_shoulder;
        if (ear.visibility > 0.7 && calibration && calibration.earX) {
            // 귀와 어깨의 X축 거리 변화량으로 '목이 앞으로 나옴'을 측정
            const currentDistX = Math.abs(ear.x - shoulder.x) * 640;
            const diffX = calibration.sideDistX - currentDistX;

            if (diffX >= 45) return 'TURTLE_NECK_WARNING';
            if (diffX >= 25) return 'TURTLE_NECK_CAUTION';
        }

    } else {
        // [정면] 코의 Y축 픽셀 변화량 (비율 방식 currentNoseToShoulder 삭제)
        if (calibration && calibration.noseY) {
            const diffY = (nose.y - calibration.noseY) * 480;

            // 핵심 로직: 
            // 1. 고개를 일정 이상 숙이지 않았을 때만(h_offset < 0.07) 거북목 검사
            // 2. 코가 영점보다 아래로 20~35px 내려왔을 때만(목이 앞으로 나옴) 거북목!
            if (h_offset < 0.07 && s_slope < 0.06) {
                if (diffY >= 35) return 'TURTLE_NECK_WARNING';
                if (diffY >= 20) return 'TURTLE_NECK_CAUTION';
            }
        }
    }
        return 'GOOD_POSTURE';
};

/**
 * 5. 맞춤형 코칭 메시지 생성
 * if 방식도 잘 작동하지만, 나중에 자세 종류가 10개, 20개로 늘어나면 코드가 너무 길어질 수 있음.
 * 아래처럼 객체(Object) 매핑 방식을 쓰면 코드가 훨씬 깔끔해지고 관리하기 편해짐
 */
const get_coaching_message = (posture_status, noise_status) => {
    // 1. 모든 메시지를 하나의 보관함(객체)에 담습니다.
    const messages = {
        'SLUMPED_WARNING': "고개를 너무 깊게 숙이고 있어요! 허리를 쭉 펴볼까요?",
        'SLUMPED_CAUTION': "자세가 조금 낮아졌네요. 고개를 들어주세요.",
        'LEANING_ON_HAND': "턱을 괴면 척추와 얼굴 대칭에 좋지 않아요.",
        'TURTLE_NECK_WARNING': "목이 앞으로 많이 나왔어요! 어깨를 펴고 고개를 들어주세요.",
        'TURTLE_NECK_CAUTION': "거북목 주의! 조금 더 바른 자세를 유지해보세요",
        'TILTED_WARNING': "몸이 한쪽으로 심하게 기울어져 있습니다. 수평을 맞춰보세요.",
        'TILTED_CAUTION': "어깨가 약간 비뚤어져 있네요.",
        'STATIC_WARNING': "30분간 움직임이 없어요! 잠시 일어나 가볍게 스트레칭 해보세요.",
        'STATIC_CAUTION': "한 자세로 너무 오래 있었어요. 몸을 조금 움직여볼까요?",
        'GOOD_POSTURE': "집중하기 딱 좋은 자세입니다!"
    };

    // 2. 우선순위 1: '정상'이 아닌 모든 나쁜 자세 메시지 처리
    if (posture_status !== 'GOOD_POSTURE' && messages[posture_status]) {
        return messages[posture_status];
    }

    // 3. 우선순위 2: 자세가 정상인데 주변이 시끄러운 경우
    if (posture_status === 'GOOD_POSTURE' && noise_status === 'NOISY') {
        return "주변이 조금 시끄럽네요. 이어폰 착용을 추천드려요.";
    }

    // 4. 모두 해당 없으면 기본 긍정 메시지 리턴
    return messages['GOOD_POSTURE'];
};

module.exports = {
    detect_camera_mode,
    analyze_noise_level,
    check_user_presence,
    analyze_posture,
    get_coaching_message,
    reset_static_tracking,
};