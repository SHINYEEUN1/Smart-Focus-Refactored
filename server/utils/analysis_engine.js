/**
 * [Smart Focus] 통합 분석 엔진
 * - 엎드림: h_offset >= 0.08 (WARNING), >= 0.03 (CAUTION)
 * - 거북목 : 측면(SIDE_LEFT/SIDE_RIGHT)에서만 판정, 귀-어깨 X축 거리 기준
 * - 핵심 랜드마크는 visibility > 0.7, 손/얼굴 보조 랜드마크는 상황별 완화 적용
 * - 턱 괴기: Face Mesh 152번(턱끝) 활용 + faceHeight 비율 기준
 */

// -------- 부동 자세 추적 상태 변수  --------
let lastNosePos = null;
let staticCheckStart = Date.now();

// 세션 초기화
const reset_static_tracking = () => {
    lastNosePos = null;
    staticCheckStart = Date.now();
};


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
 * @param {Object} calibration   - 정자세 기준값 { noseY: 정면코높이, sideDistX: 측면귀어깨거리 }
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
     * [0] 부동 자세 판정 (STATIC) - 가장 먼저 검사
     * 세부 자세를 보기 전, 장시간 움직임이 없는지 먼저 확인
     */
    const now = Date.now();
    const staticTime = now - staticCheckStart;

    if (staticTime >= 1200000) { // 20분 이상 경과
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
    // 어깨는 보이는데 코가 안 보이면 엎드린 걸로 간주
    if (left_shoulder.visibility > 0.5 && right_shoulder.visibility > 0.5) {
        if (nose.visibility < 0.3) return 'SLUMPED_WARNING';
    }
    // 핵심 랜드마크가 완전히 안 보이면 판정 불가
    if (nose.visibility < 0.1 || left_shoulder.visibility < 0.1 || right_shoulder.visibility < 0.1) {
        return 'UNKNOWN';
    }

    const shoulder_y_avg = (left_shoulder.y + right_shoulder.y) / 2;
    // 양수일수록 코가 어깨 아래에 위치(엎드림)
    const h_offset = nose.y - shoulder_y_avg;
    const s_slope = Math.abs(left_shoulder.y - right_shoulder.y);

    /**
     * [1] 턱 괴기 판정 (LEANING_ON_HAND)
     */
    // 손목, 손날, 검지 중 하나라도 보이면 시작 (가시성 기준을 0.1로 완화)
    const handVisible = left_wrist.visibility > 0.1 || right_wrist.visibility > 0.1 ||
                        left_index.visibility > 0.1 || right_index.visibility > 0.1;

    if (handVisible) {
        let chinPoint;
        // Face Mesh 데이터가 있다면 가장 정확한 턱끝(152번) 좌표 활용
        if (faceLandmarks && faceLandmarks[152]) {
            chinPoint = { x: faceLandmarks[152].x, y: faceLandmarks[152].y };
        } else {
            // 폴백: 입꼬리 중간 지점
            chinPoint = {
                x: (landmarks[9].x + landmarks[10].x) / 2,
                y: (landmarks[9].y + landmarks[10].y) / 2,
            };
        }

        const faceHeight = Math.abs(nose.y - chinPoint.y);

        if (faceHeight > 0.001) {
            const distL = Math.min(
                Math.sqrt(Math.pow(left_wrist.x - chinPoint.x, 2) + Math.pow(left_wrist.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(left_pinky.x - chinPoint.x, 2) + Math.pow(left_pinky.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(left_index.x - chinPoint.x, 2) + Math.pow(left_index.y - chinPoint.y, 2))
            );

            const distR = Math.min(
                Math.sqrt(Math.pow(right_wrist.x - chinPoint.x, 2) + Math.pow(right_wrist.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(right_pinky.x - chinPoint.x, 2) + Math.pow(right_pinky.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(right_index.x - chinPoint.x, 2) + Math.pow(right_index.y - chinPoint.y, 2))
            );

            const ratio = Math.min(distL, distR) / faceHeight;

            // Face Mesh 없으면 기준을 0.7로 완화, 있으면 0.45 유지 (Pose만으로는 정밀도가 낮음)
            const finalThreshold = faceLandmarks ? 0.45 : 0.7;

            if (ratio < finalThreshold) {
                console.log(`!!! 턱 괴기 감지 (비율: ${ratio.toFixed(2)}, Mesh: ${!!faceLandmarks}) !!!`);
                return 'LEANING_ON_HAND';
            }
        }
    }

    /**
     * [2] 기울어짐 판정 (TILTED)
    */
    if (s_slope >= 0.07) return 'TILTED_WARNING'; // 경고
    if (s_slope >= 0.03) return 'TILTED_CAUTION'; // 주의
    
    /**
     * [3] 엎드림 판정
     */
    // 3-1. h_offset 기준 (즉각 감지)
    if (h_offset >= 0.08) return 'SLUMPED_WARNING'; 

    // 3-2. calibration 기준 코 위치 변화량으로 판정 (정면 한정)
    if (currentMode === 'FRONT_VIEW' && calibration && calibration.noseY) {
        const diffY = (nose.y - calibration.noseY) * 480; // 코가 아래로 내려간 픽셀 값

        // 50 이상일 때만 위험(WARNING)으로 간주
        if (diffY >= 50) return 'SLUMPED_WARNING'; 
        // 20~49 구간은 주의(CAUTION)로 유지
        if (diffY >= 20) return 'SLUMPED_CAUTION';
    }

    // 3-3. h_offset 주의 보조 판정
    if (h_offset >= 0.03) return 'SLUMPED_CAUTION';
   
   
    /**
     * [4] 거북목 판정 (TURTLE_NECK) - 측면 촬영 시에만 판정
     *  귀-어깨 X축 거리가 calibration 대비 좁아지면 목이 앞으로 나온 것으로 판정
     */
    if (currentMode.startsWith('SIDE')) {
        const ear = currentMode === 'SIDE_LEFT' ? left_ear : right_ear;
        const shoulder = currentMode === 'SIDE_LEFT' ? left_shoulder : right_shoulder;

        if (ear.visibility > 0.7 && calibration && calibration.sideDistX) {
            // 4-1. 현재 귀와 어깨의 X축 거리 차이
            const currentDistX = Math.abs(ear.x - shoulder.x) * 640;
            const diffX = calibration.sideDistX - currentDistX;
            
            // 4-2. 고개가 아래로 숙여진 정도 (Y축 변화)
            // 정면에서 20px까지 허용해준 것처럼, 측면에서도 Y축 하락분 계산
            const diffY = (ear.y - (shoulder.y - 0.15)) * 480;

            // 4-3. 보정치 적용: 고개를 숙일수록 거북목 기준(25)을 조금 더 높여줌
            // 숙임 정도(diffY)의 절반 정도를 기준값에 더해서 허용치 높여줌
            let allowTolerance = 0;
            if (diffY > 10) allowTolerance = diffY * 0.5; // 숙인 만큼 기준을 넉넉하게!

            const dynamicThreshold = 25 + allowTolerance;

            if (diffX >= dynamicThreshold + 20) return 'TURTLE_NECK_WARNING';
            if (diffX >= dynamicThreshold) return 'TURTLE_NECK_CAUTION';
        }
    }

    return 'GOOD_POSTURE';
};

/**
 * 5. 맞춤형 코칭 메시지 생성
 * if 방식: 나중에 자세 종류가 10개, 20개로 늘어나면 코드가 너무 길어질 수 있음.
 * 자세 상태 코드를 키로, 안내 메시지를 값으로 매핑 (확장 용이, 상태 추가 시 messages 객체만 수정)
 */
const get_coaching_message = (posture_status, noise_status) => {
    const messages = {
        'SLUMPED_WARNING': "고개를 너무 깊게 숙이고 있어요! 허리를 쭉 펴볼까요?",
        'SLUMPED_CAUTION': "자세가 조금 낮아졌네요. 고개를 들어주세요.",
        'LEANING_ON_HAND': "턱을 괴면 척추와 얼굴 대칭에 좋지 않아요.",
        'TURTLE_NECK_WARNING': "목이 앞으로 많이 나왔어요! 목에 약 27kg의 부담이 가고 있어요. 어깨를 펴고 고개를 들어주세요.",
        'TURTLE_NECK_CAUTION': "거북목 주의! 목에 약 18kg의 부담이 가고 있어요. 조금 더 바른 자세를 유지해보세요",
        'TILTED_WARNING': "몸이 한쪽으로 심하게 기울어져 있습니다. 수평을 맞춰보세요.",
        'TILTED_CAUTION': "어깨가 약간 기울어져 있네요.",
        'STATIC_WARNING': "30분간 움직임이 없어요! 잠시 일어나 가볍게 스트레칭 해보세요.",
        'STATIC_CAUTION': "한 자세로 너무 오래 있었어요. 몸을 조금 움직여볼까요?",
        'GOOD_POSTURE': "집중하기 딱 좋은 자세입니다!"
    };

    // 우선순위 1: '정상'이 아닌 모든 나쁜 자세 메시지 처리
    if (posture_status !== 'GOOD_POSTURE' && messages[posture_status]) {
        return messages[posture_status];
    }

    // 우선순위 2: 자세가 정상이지만 주변이 시끄러운 경우
    if (posture_status === 'GOOD_POSTURE' && noise_status === 'NOISY') {
        return "주변이 조금 시끄럽네요. 이어폰 착용을 추천드려요.";
    }

    // 모두 해당 없으면 기본 긍정 메시지 리턴
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