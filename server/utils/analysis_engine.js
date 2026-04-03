// utils/analysis_engine.js
const {
  POSTURE_STATUS,
} = require('../../shared/constants/posture');
/**
 * [Smart Focus] 통합 분석 엔진 v2.0
 * --------------------------------------------------------------------------
 * [주요 분석 로직]
 * 1. 부동 자세 (STATIC): 코(Nose) 위치 변화량 < 0.05 기준, 20분(CAUTION) / 30분(WARNING) 추적
 * 2. 카메라 모드: 어깨 너비(offset) 기준 정면(FRONT) 및 측면(SIDE_L/R) 자동 전환 (임계치 0.30)
 * 3. 턱 괴기 (LEANING_ON_HAND): 턱끝(152) 또는 입꼬리 대비 손목/손가락 거리 비율 분석 (Threshold 0.90~0.95)
 * 4. 얼굴 근처 손 (HAND_NEAR_FACE): 손목이 코 높이(+0.05) 위로 올라올 시 주의 판정
 * 5. 거북목 (TURTLE_NECK): 
 * - 정면: 원근법 원리(귀 거리 비율) 및 Y축 하락 보정 적용
 * - 측면: 귀-어깨 X축 거리 변화량(sideDistX) 및 Y축 숙임 정도에 따른 동적 임계치 적용
 * 6. 엎드림 (SLUMPED): 코-어깨 Y축 오프셋(0.06/0.02) 및 영점 대비 하락 폭(40px/18px) 복합 판정
 * 7. 기울어짐 (TILTED): 양쪽 어깨 기울기(s_slope) 분석 (정면 0.07 / 측면 0.15 완화 적용)
 * * [신뢰도 기준] 핵심 랜드마크(코, 어깨) visibility > 0.7 권장 (최소 0.1 미만 시 UNKNOWN)
 * --------------------------------------------------------------------------
 */

// -------- 부동 자세 추적 상태 변수  --------
let lastNosePos = null;
let staticCheckStart = performance.now();

// 세션 초기화
const reset_static_tracking = () => {
    lastNosePos = null;
    staticCheckStart = performance.now();
};


// 1. 카메라 위치 및 모드 감지 (어깨 너비 기반)
const detect_camera_mode = (landmarks) => {
    if (!landmarks || landmarks.length < 13) return 'FRONT_VIEW';
    const left_shoulder = landmarks[11];
    const right_shoulder = landmarks[12];

    // 양쪽 어깨 사이의 유클리드 거리 계산
    const offset = Math.sqrt(
        Math.pow(left_shoulder.x - right_shoulder.x, 2) +
        Math.pow(left_shoulder.y - right_shoulder.y, 2)
    );

    // 0.15 -> 0.25 -> 0.30으로 변경 (측면 인식을 훨씬 더 잘하게 됨)
    const mode = offset < 0.30
        ? (left_shoulder.x > right_shoulder.x ? 'SIDE_RIGHT' : 'SIDE_LEFT')
        : 'FRONT_VIEW';

    console.log(`[모드 감지] 어깨너비: ${offset.toFixed(3)}, 판정모드: ${mode}`);

    return mode;
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
    const now = performance.now(); // 현재 정밀 시간 측정

    // 0-1. 움직임 계산 (코의 위치 변화량)
    const move = lastNosePos
        ? Math.sqrt(Math.pow(nose.x - lastNosePos.x, 2) + Math.pow(nose.y - lastNosePos.y, 2))
        : 1; // 첫 실행 시 0으로 시작 (또는 적절한 초기값)

    // 0-2. 움직임 감지 시 즉시 리셋 (20분 되기 전이라도 매 프레임 검사)
    if (move > 0.05) {
        lastNosePos = { x: nose.x, y: nose.y };
        staticCheckStart = now;
    }

    // 0-3. 움직임이 없는 경우에만 누적 시간 계산
    const staticTime = now - staticCheckStart;
    let currentStaticAlert = 'NORMAL';

    // 테스트: CAUTION 45초, WARNING 1분으로 해봄 => 성공
    if (staticTime >= 1800000) {
        currentStaticAlert = 'STATIC_WARNING';
    } else if (staticTime >= 1200000) {
        currentStaticAlert = 'STATIC_CAUTION';
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
    // 손목, 손날, 검지 중 하나라도 보이면 시작 
    // (오인식 방지를 위해 가시성 기준을 0.1에서 0.2으로 상향, 0.3보다는 낮춰서 인식률 높임)
    const handVisible =
        left_wrist.visibility > 0.2 || right_wrist.visibility > 0.1 ||
        left_index.visibility > 0.2 || right_index.visibility > 0.1 ||
        left_pinky.visibility > 0.2 || right_pinky.visibility > 0.1;

    if (handVisible) {
        // 얼굴/머리 주변 손 감지 (턱 괴기와 상태 분리)
        // 손목이 코 높이(+0.05)보다 위로 올라오면 '얼굴 근처 손'으로 먼저 판정
        const isHandNearFace = (left_wrist.y < nose.y + 0.05) || (right_wrist.y < nose.y + 0.05);

        if (isHandNearFace && (left_wrist.visibility > 0.5 || right_wrist.visibility > 0.5)) {
            console.log("⚠️ 얼굴/머리 근처 손 감지 (HAND_NEAR_FACE_CAUTION)");
            return 'HAND_NEAR_FACE_CAUTION'; // 턱 괴기와 다른 상태값을 리턴!
        }

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
                Math.sqrt(Math.pow(left_wrist.x - chinPoint.x, 2) + Math.pow(left_wrist.y - chinPoint.y, 2)) * 0.7,
                Math.sqrt(Math.pow(left_pinky.x - chinPoint.x, 2) + Math.pow(left_pinky.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(left_index.x - chinPoint.x, 2) + Math.pow(left_index.y - chinPoint.y, 2))
            );

            const distR = Math.min(
                Math.sqrt(Math.pow(right_wrist.x - chinPoint.x, 2) + Math.pow(right_wrist.y - chinPoint.y, 2)) * 0.7,
                Math.sqrt(Math.pow(right_pinky.x - chinPoint.x, 2) + Math.pow(right_pinky.y - chinPoint.y, 2)),
                Math.sqrt(Math.pow(right_index.x - chinPoint.x, 2) + Math.pow(right_index.y - chinPoint.y, 2))
            );

            const ratio = Math.min(distL, distR) / faceHeight;

            // Face Mesh 없으면 기준을 0.95로 완화, 있으면 0.90 유지 (Pose만으로는 정밀도가 낮음)
            // (수치가 높을수록 턱 괴기 판정 범위가 넓어져 더 예민하게 반응함)
            const finalThreshold = faceLandmarks ? 0.90 : 0.95;

            if (ratio < finalThreshold) {
                console.log(`!!! 턱 괴기 감지 (비율: ${ratio.toFixed(2)}, Mesh: ${!!faceLandmarks}) !!!`);
                return 'LEANING_ON_HAND';
            }
        }
    }

    /**
     * [2] 거북목 판정 (TURTLE_NECK) - 측면 촬영 시에만 판정
     *  귀-어깨 X축 거리가 calibration 대비 좁아지면 목이 앞으로 나온 것으로 판정
    */
    /**
    * 1) 원근법 원리: 목을 앞으로 밀면 카메라와 가까워져 '양쪽 귀 사이 거리'가 멀어짐 (Ratio 기반)
    * 2) 수직 위치 보정: 단순 '엎드림(고개 숙임)'과 구분하기 위해, 코의 높이(Y축) 변화가 적을 때만 거북목으로 간주
    */
    // 정면 촬영 시
    if (currentMode === 'FRONT_VIEW' && calibration && calibration.baseEarDist) {
        // 현재 화면에서의 귀 거리와 어깨 너비 계산 (단위: px)
        const currentEarDist = Math.abs(left_ear.x - right_ear.x) * 640;

        // [원근법 보정] 어깨 너비 대비 귀 거리의 '상대적' 비율 계산
        // 몸이 앞으로 다가오면 분모/분자가 같이 커져서 1.0 유지, 목만 나오면 수치가 올라감
        const neckRatio = currentEarDist / calibration.baseEarDist;
        // [수직 위치 보정] 영점 대비 코의 하락 폭 (px)
        // 엎드림(SLUMPED)과 거북목을 구분
        const verticalDiff = (nose.y - calibration.noseY) * 480; // 영점 대비 코의 하락 폭(px)

        // 상수 설정 (Thresholds)
        const TURTLE_WARNING_THRESH = 1.05; // 5% 이상 돌출 시 (위험)
        const TURTLE_CAUTION_THRESH = 1.01; // 1.1% 이상 돌출 시 (주의)
        const SLUMPED_LIMIT_PX = 40;        // 40px 이상 내려가면 '엎드림'으로 판단하여 거북목 제외

        // ✨ 수치 확인을 위한 로그 추가 (테스트 시 필수!)
        console.log(`[정면 분석] 비율: ${neckRatio.toFixed(2)}, Y축하락: ${verticalDiff.toFixed(1)}px`);

        // 판정 실행
        if (nose.visibility > 0.8 && verticalDiff < SLUMPED_LIMIT_PX) {
            // 위험(WARNING) 단계 우선 판정
            if (neckRatio > TURTLE_WARNING_THRESH) {
                console.log("🚨 정면 거북목 [위험] 감지!");
                return 'TURTLE_NECK_WARNING';
            }
            // 주의(CAUTION) 단계 판정
            if (neckRatio > TURTLE_CAUTION_THRESH) {
                console.log("⚠️ 정면 거북목 [주의] 감지!");
                return 'TURTLE_NECK_CAUTION';
            }
        }
    }

    // 측면 촬영 시
    // SIDE_VIEW 수동 영점 조절 모드
    if (currentMode.startsWith('SIDE') && calibration && calibration.sideDistX) {
        const ear = currentMode === 'SIDE_LEFT' ? left_ear : right_ear;
        const shoulder = currentMode === 'SIDE_LEFT' ? left_shoulder : right_shoulder;

        // 귀가 잘 보일 때만 분석
        if (ear.visibility > 0.7) {
            // 2-1. 현재 귀와 어깨의 X축 거리 차이(px)
            // 단순 거리 차이가 아니라, '귀가 어깨보다 얼마나 앞에 있나'를 계산
            // RIGHT 모드일 땐 귀.x < 어깨.x 이고, LEFT 모드일 땐 귀.x > 어깨.x 일 수 있음
            const currentDistX = Math.abs(ear.x - shoulder.x) * 640;

            // 2-2. 방향성 체크: 목을 내밀었는데 마이너스가 나온다면? 
            // 일단 수동으로 diffX에 절대값을 씌우거나 영점 잡을 때의 상태를 강제 동기화
            let diffX = currentDistX - calibration.sideDistX;

            // 만약 마이너스가 너무 크게 나오면 방향이 뒤집힌 것이니 반전 시킴
            if (diffX < -30) diffX = Math.abs(diffX);

            // 2-3. 고개가 아래로 숙여진 정도 (Y축 변화 보정)
            // 정면에서 20px까지 허용해준 것처럼, 측면에서도 Y축 하락분 계산
            const diffY = (ear.y - (shoulder.y - 0.15)) * 480;

            // 2-4. 보정치 적용: 고개를 숙일수록 거북목 기준(25)을 조금 더 높여줌
            // 숙임 정도(diffY)의 절반 정도를 기준값에 더해서 허용치 높여줌
            let allowTolerance = diffY > 10 ? diffY * 0.5 : 0;
            const dynamicThreshold = 25 + allowTolerance;


            // 측면 거북목 정밀 분석 로그
            // 영점을 잡으면 diffX가 0 근처가 나와야 정상
            console.log(
                `⭐[측면 분석] 이동량: ${diffX.toFixed(1)}px, ` +
                `보정치: +${allowTolerance.toFixed(1)}px, ` +
                `기준: ${dynamicThreshold.toFixed(1)}px`
            );

            // 2-4. 최종 판정
            if (diffX >= dynamicThreshold + 20) return 'TURTLE_NECK_WARNING';
            if (diffX >= dynamicThreshold) return 'TURTLE_NECK_CAUTION';
        }
    }

    /**
     * [3] 기울어짐 판정 (TILTED)
    */
    // 현재 모드가 측면인지 확인
    const isSide = currentMode.startsWith('SIDE');

    // 측면이면 기준을 0.15로 완화, 정면이면 0.07 그대로 유지
    const tiltThreshold = isSide ? 0.15 : 0.07;
    const tiltCautionThreshold = isSide ? 0.10 : 0.03;

    if (s_slope >= tiltThreshold) return 'TILTED_WARNING'; // 경고
    if (s_slope >= tiltCautionThreshold) return 'TILTED_CAUTION'; // 주의

    /**
     * [4] 엎드림 판정
     */
    // 4-1. h_offset 기준 (즉각 감지)
    if (h_offset >= 0.06) return 'SLUMPED_WARNING';

    // 4-2. calibration 기준 코 위치 변화량으로 판정 (정면 한정)
    if (currentMode === 'FRONT_VIEW' && calibration && calibration.noseY) {
        const diffY = (nose.y - calibration.noseY) * 480; // 코가 아래로 내려간 픽셀 값

        // 40 이상일 때만 위험(WARNING)으로 간주
        if (diffY >= 40) return 'SLUMPED_WARNING';
        // 18~39 구간은 주의(CAUTION)로 유지
        if (diffY >= 18) return 'SLUMPED_CAUTION';
    }

    // 4-3. h_offset 주의 보조 판정
    if (h_offset >= 0.02) return 'SLUMPED_CAUTION';


    /**
         * [최종 결과 반환]
         * 위에서 어떠한 나쁜 자세도 감지되지 않았다면(GOOD_POSTURE 후보라면),
         * 그때 '부동 자세(Static)'였는지 확인하여 최종 상태를 반환합니다.
         */
    return currentStaticAlert !== 'NORMAL' ? currentStaticAlert : 'GOOD_POSTURE';
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
        'HAND_NEAR_FACE_CAUTION': "얼굴이나 머리 근처에 손이 있네요. 손을 내리고 다시 집중해 볼까요?",
        'LEANING_ON_HAND': "턱을 괴면 척추와 얼굴 대칭에 좋지 않아요.",
        'TURTLE_NECK_WARNING': "목이 앞으로 많이 나왔어요! 목에 약 27kg의 부담이 가고 있어요. 어깨를 펴고 고개를 들어주세요.",
        'TURTLE_NECK_CAUTION': "거북목 주의! 목에 약 18kg의 부담이 가고 있어요. 조금 더 바른 자세를 유지해보세요",
        'TILTED_WARNING': "몸이 한쪽으로 심하게 기울어져 있습니다. 수평을 맞춰보세요.",
        'TILTED_CAUTION': "어깨가 약간 기울어져 있네요.",
        'STATIC_WARNING': "30분간 움직임이 없었어요! 잠시 일어나 가볍게 스트레칭 해보세요.",
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