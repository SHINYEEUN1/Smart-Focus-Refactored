// utils/analysis_engine.js
const { POSTURE_STATUS } = require('../../shared/constants/posture');

/**
 * [Smart Focus] 통합 분석 엔진
 * --------------------------------------------------------------------------
 * [주요 분석 로직]
 * 1. 부동 자세 (STATIC)     : 코(Nose) 위치 변화량 < 0.05 기준, 20분(CAUTION) / 30분(WARNING) 추적
 * 2. 카메라 모드            : 어깨 너비 기준 정면(FRONT) 및 측면(SIDE_L/R) 자동 전환 (임계치 0.30)
 * 3. 턱 괴기 (LEANING)      : 턱끝(152) 또는 입꼬리 대비 손목/손가락 거리 비율 분석 (0.90~0.95)
 * 4. 얼굴 근처 손 (HAND)    : 손목이 코 높이(+0.05) 위로 올라올 시 주의 판정
 * 5. 거북목 (TURTLE_NECK)   :
 *    - 정면: 원근법 원리(귀 거리 비율) 및 Y축 하락 보정 적용
 *    - 측면: 귀-어깨 X축 거리 변화량 및 Y축 숙임 정도에 따른 동적 임계치 적용
 * 6. 엎드림 (SLUMPED)       : 코-어깨 Y축 오프셋(0.04/0.02) 및 영점 대비 하락 폭(40px/18px) 복합 판정
 * 7. 기울어짐 (TILTED)      : 양쪽 어깨 기울기(shoulderTilt) 분석 (정면 0.07 / 측면 0.15 완화 적용)
 *
 * [신뢰도 기준]
 * - 핵심 랜드마크(코, 어깨) visibility > 0.7 권장 (MediaPipe 공식 권장값)
 * - visibility < 0.1 미만 시 판정 불가(UNKNOWN) 처리 — 배경 인물 오인식 방지
 * --------------------------------------------------------------------------
 */

// 개발 환경에서만 디버그 로그 출력 (프로덕션 매 프레임 출력 시 성능 저하 방지)
const DEBUG = process.env.NODE_ENV === 'development';

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────

/**
 * 두 2D 좌표 간의 유클리드 거리 계산 (MediaPipe 정규화 좌표 0~1 범위 기준)
 * Math.pow 대신 곱셈을 사용해 성능 최적화 (~30% 빠름)
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
const euclideanDist = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
};

/**
 * 턱끝 좌표 결정
 * Face Mesh의 152번 랜드마크(턱끝)가 가장 정확하므로 우선 사용.
 * Face Mesh 데이터가 없을 경우 Pose의 입꼬리 중간값(9, 10번)으로 폴백.
 * @param {Array|null} faceLandmarks - Face Mesh 랜드마크 배열
 * @param {Array}      poseLandmarks - Pose 랜드마크 배열
 * @returns {{ x: number, y: number }}
 */
const getChinPoint = (faceLandmarks, poseLandmarks) => {
    if (faceLandmarks?.[152]) {
        return { x: faceLandmarks[152].x, y: faceLandmarks[152].y };
    }
    return {
        x: (poseLandmarks[9].x + poseLandmarks[10].x) / 2,
        y: (poseLandmarks[9].y + poseLandmarks[10].y) / 2,
    };
};

// ─── 모듈 레벨 상수 ───────────────────────────────────────────────────────────

/**
 * 자세 상태별 코칭 메시지 매핑 (모듈 로드 시 1회만 생성)
 * 함수 내부에 두면 호출마다 새 객체가 힙에 생성되어 GC 부담이 증가하므로 외부로 이동.
 * 새로운 자세 판정이 추가될 경우 이 객체만 수정하면 됨.
 */
const COACHING_MESSAGES = {
    [POSTURE_STATUS.SLUMPED_WARNING]:       '고개를 너무 깊게 숙이고 있어요! 허리를 쭉 펴볼까요?',
    [POSTURE_STATUS.SLUMPED_CAUTION]:       '자세가 조금 낮아졌네요. 고개를 들어주세요.',
    [POSTURE_STATUS.HAND_NEAR_FACE_CAUTION]:'얼굴이나 머리 근처에 손이 있네요. 손을 내리고 다시 집중해 볼까요?',
    [POSTURE_STATUS.LEANING_ON_HAND]:       '턱을 괴면 척추와 얼굴 대칭에 좋지 않아요.',
    [POSTURE_STATUS.TURTLE_NECK_WARNING]:   '목이 앞으로 많이 나왔어요! 목에 약 27kg의 부담이 가고 있어요. 어깨를 펴고 고개를 들어주세요.',
    [POSTURE_STATUS.TURTLE_NECK_CAUTION]:   '거북목 주의! 목에 약 18kg의 부담이 가고 있어요. 조금 더 바른 자세를 유지해보세요',
    [POSTURE_STATUS.TILTED_WARNING]:        '몸이 한쪽으로 심하게 기울어져 있습니다. 수평을 맞춰보세요.',
    [POSTURE_STATUS.TILTED_CAUTION]:        '어깨가 약간 기울어져 있네요.',
    [POSTURE_STATUS.STATIC_WARNING]:        '30분간 움직임이 없었어요! 잠시 일어나 가볍게 스트레칭 해보세요.',
    [POSTURE_STATUS.STATIC_CAUTION]:        '한 자세로 너무 오래 있었어요. 몸을 조금 움직여볼까요?',
    [POSTURE_STATUS.GOOD_POSTURE]:          '집중하기 딱 좋은 자세입니다!',
};

// ─── 부동 자세 추적 상태 변수 ─────────────────────────────────────────────────
// 모듈 레벨에서 유지 — 프레임 간 연속 추적이 필요하므로 함수 외부에 선언
let lastNosePos = null;
let staticCheckStart = performance.now();

/**
 * 세션 초기화 시 부동 자세 추적 상태를 리셋
 * 새 집중 세션이 시작될 때 이전 세션의 정적 타이머가 이어지지 않도록 초기화
 */
const reset_static_tracking = () => {
    lastNosePos = null;
    staticCheckStart = performance.now();
};

// ─── 자세 판정 서브 함수 ──────────────────────────────────────────────────────

/**
 * 부동 자세 추적 및 알림 레벨 결정
 * 코(Nose) 위치 변화량을 매 프레임 누적해 정적 유지 시간을 측정.
 * 움직임이 감지되면 즉시 타이머를 리셋.
 *
 * [임계치 근거]
 * - noseMovement > 0.05 : 정규화 좌표 기준 약 3~4cm — 미세 떨림은 무시하되 실질적 움직임은 감지
 * - STATIC_CAUTION (20분) : 집중 연구에서 20분이 지속 집중의 권장 한계선
 * - STATIC_WARNING (30분) : 30분 이상 동일 자세는 혈액 순환 저하 및 근골격계 부담 시작
 *
 * @param {Object} nose - 코 랜드마크 { x, y }
 * @param {number} now  - performance.now() 현재 시각 (ms)
 * @returns {string|null} STATIC_WARNING | STATIC_CAUTION | null(정상)
 */
const updateStaticTracking = (nose, now) => {
    // 첫 프레임은 비교 대상이 없으므로 1로 초기화해 움직임이 있는 것으로 처리
    const noseMovement = lastNosePos ? euclideanDist(nose, lastNosePos) : 1;

    // 움직임이 임계치 이상이면 타이머 리셋 (20~30분 누적 전이라도 매 프레임 검사)
    if (noseMovement > 0.05) {
        lastNosePos = { x: nose.x, y: nose.y };
        staticCheckStart = now;
    }

    const staticTime = now - staticCheckStart;

    if (staticTime >= 1800000) return POSTURE_STATUS.STATIC_WARNING;  // 30분
    if (staticTime >= 1200000) return POSTURE_STATUS.STATIC_CAUTION;  // 20분
    return null;
};

/**
 * 턱 괴기 / 얼굴 근처 손 판정
 * 손목·손가락 랜드마크가 코 높이 이상으로 올라오면 손 관련 자세로 판정.
 *
 * [판정 순서]
 * 1. HAND_NEAR_FACE_CAUTION : 손목이 코 높이(+0.05 여유) 위에 있고 신뢰도 0.5 이상
 * 2. LEANING_ON_HAND        : 손·손가락과 턱끝의 거리 비율이 임계치 미만
 *
 * [임계치 근거]
 * - handToChinRatio < 0.90 (Face Mesh 있음) : Face Mesh로 정밀한 턱끝 좌표 확보 가능
 * - handToChinRatio < 0.95 (Face Mesh 없음) : Pose만으로는 턱 좌표 정밀도가 낮아 기준 완화
 * - 손목 거리 * 0.7 가중치 : 손목보다 손가락 끝이 턱에 닿을 가능성이 더 높으므로 보정
 * - 손 가시성 기준 0.2/0.1  : 0.1이면 오인식 증가, 0.3이면 검출률 저하 — 절충값 채택
 *
 * @param {Array}      landmarks
 * @param {Object}     nose
 * @param {Array|null} faceLandmarks
 * @returns {string|null}
 */
const checkHandPosture = (landmarks, nose, faceLandmarks) => {
    const left_wrist  = landmarks[15];
    const right_wrist = landmarks[16];
    const left_pinky  = landmarks[17];
    const right_pinky = landmarks[18];
    const left_index  = landmarks[19];
    const right_index = landmarks[20];

    // 손목, 손날, 검지 중 하나라도 보여야 판정 시작
    const isHandVisible =
        left_wrist.visibility  > 0.2 || right_wrist.visibility  > 0.1 ||
        left_index.visibility  > 0.2 || right_index.visibility  > 0.1 ||
        left_pinky.visibility  > 0.2 || right_pinky.visibility  > 0.1;

    if (!isHandVisible) return null;

    // [HAND_NEAR_FACE] 손목이 코 높이(+0.05 여유)보다 위에 있으면 얼굴 주변 손으로 우선 판정
    // 턱 괴기보다 먼저 검사해야 두 상태가 겹치지 않음
    const isHandNearFace = (left_wrist.y < nose.y + 0.05) || (right_wrist.y < nose.y + 0.05);
    if (isHandNearFace && (left_wrist.visibility > 0.5 || right_wrist.visibility > 0.5)) {
        if (DEBUG) console.log('⚠️ 얼굴/머리 근처 손 감지 (HAND_NEAR_FACE_CAUTION)');
        return POSTURE_STATUS.HAND_NEAR_FACE_CAUTION;
    }

    // [LEANING_ON_HAND] 손목/손가락과 턱끝의 거리 비율로 턱 괴기 판정
    const chinPoint = getChinPoint(faceLandmarks, landmarks);
    const noseToChinnDist = Math.abs(nose.y - chinPoint.y);

    // 코-턱 거리가 너무 짧으면 랜드마크 오류 가능 — 판정 제외
    if (noseToChinnDist <= 0.001) return null;

    // 손목에 0.7 가중치: 손목보다 손가락 끝이 턱에 먼저 닿으므로 손목 거리를 약간 줄여 보정
    const chinDistLeft = Math.min(
        euclideanDist(left_wrist,  chinPoint) * 0.7,
        euclideanDist(left_pinky,  chinPoint),
        euclideanDist(left_index,  chinPoint)
    );
    const chinDistRight = Math.min(
        euclideanDist(right_wrist, chinPoint) * 0.7,
        euclideanDist(right_pinky, chinPoint),
        euclideanDist(right_index, chinPoint)
    );

    const handToChinRatio = Math.min(chinDistLeft, chinDistRight) / noseToChinnDist;
    // Face Mesh 없으면 기준을 0.95로 완화, 있으면 0.90 유지
    const leanThreshold = faceLandmarks ? 0.90 : 0.95;

    if (handToChinRatio < leanThreshold) {
        if (DEBUG) console.log(`!!! 턱 괴기 감지 (비율: ${handToChinRatio.toFixed(2)}, Mesh: ${!!faceLandmarks}) !!!`);
        return POSTURE_STATUS.LEANING_ON_HAND;
    }

    return null;
};

/**
 * 거북목 판정 (TURTLE_NECK)
 *
 * [정면 판정 원리 - 원근법 기반]
 * 목을 앞으로 밀면 카메라와 가까워져 '양쪽 귀 사이 거리'가 멀어짐.
 * 단순 귀 거리가 아닌 영점 대비 '비율(neckRatio)'로 판정해 카메라-사람 간 거리 변화 영향을 제거.
 * 코의 Y축 하락이 크면 거북목이 아닌 '엎드림'으로 간주해 판정 제외.
 *
 * [정면 임계치 근거]
 * - TURTLE_WARNING_THRESH = 1.05 : 귀 거리가 기준 대비 5% 증가 = 목이 약 2~3cm 앞으로 나온 것 (실험값)
 * - TURTLE_CAUTION_THRESH = 1.01 : 1% 돌출 시 주의 — 초기 거북목 습관을 조기에 교정하기 위한 값
 * - SLUMPED_LIMIT_PX = 40        : 코가 40px 이상 내려가면 거북목이 아닌 엎드림으로 처리
 *
 * [측면 판정 원리]
 * 귀-어깨 X축 거리가 영점 대비 줄어들면 목이 앞으로 나온 것으로 판정.
 * 고개를 숙이면 X축 거리도 줄어 오인식 발생 → diffY 기반 headTiltTolerance 동적 적용.
 *
 * @param {string}      mode
 * @param {Array}       landmarks
 * @param {Object|null} calibration
 * @returns {string|null}
 */
const checkTurtleNeck = (mode, landmarks, calibration) => {
    if (!calibration) return null;

    const nose           = landmarks[0];
    const left_ear       = landmarks[7];
    const right_ear      = landmarks[8];
    const left_shoulder  = landmarks[11];
    const right_shoulder = landmarks[12];

    // 정면 촬영 판정
    if (mode === 'FRONT_VIEW' && calibration.baseEarDist) {
        const currentEarDist = Math.abs(left_ear.x - right_ear.x) * 640;
        const neckRatio      = currentEarDist / calibration.baseEarDist;
        const verticalDiff   = (nose.y - calibration.noseY) * 480;

        const TURTLE_WARNING_THRESH = 1.05;
        const TURTLE_CAUTION_THRESH = 1.01;
        const SLUMPED_LIMIT_PX      = 40;

        if (DEBUG) console.log(`[정면 분석] 비율: ${neckRatio.toFixed(2)}, Y축하락: ${verticalDiff.toFixed(1)}px`);

        if (nose.visibility > 0.8 && verticalDiff < SLUMPED_LIMIT_PX) {
            if (neckRatio > TURTLE_WARNING_THRESH) {
                if (DEBUG) console.log('🚨 정면 거북목 [위험] 감지!');
                return POSTURE_STATUS.TURTLE_NECK_WARNING;
            }
            if (neckRatio > TURTLE_CAUTION_THRESH) {
                if (DEBUG) console.log('⚠️ 정면 거북목 [주의] 감지!');
                return POSTURE_STATUS.TURTLE_NECK_CAUTION;
            }
        }
        return null;
    }

    // 측면 촬영 판정
    if (mode.startsWith('SIDE') && calibration.sideDistX) {
        const ear      = mode === 'SIDE_LEFT' ? left_ear      : right_ear;
        const shoulder = mode === 'SIDE_LEFT' ? left_shoulder : right_shoulder;

        // 귀 가시성이 충분할 때만 분석 (0.7 미만이면 측면 랜드마크 신뢰 불가)
        if (ear.visibility <= 0.7) return null;

        const currentDistX = Math.abs(ear.x - shoulder.x) * 640;
        let diffX = currentDistX - calibration.sideDistX;

        // diffX < -30이면 카메라 각도나 자세에 따라 귀-어깨 방향이 반전된 것 — 절대값으로 보정
        if (diffX < -30) diffX = Math.abs(diffX);

        const diffY = (ear.y - (shoulder.y - 0.15)) * 480;

        // 고개를 숙이면 X축 거리도 줄어 오인식 발생 → diffY의 절반을 허용치에 추가
        const headTiltTolerance = diffY > 10 ? diffY * 0.5 : 0;
        const dynamicThreshold  = 25 + headTiltTolerance;

        if (DEBUG) {
            console.log(
                `⭐[측면 분석] 이동량: ${diffX.toFixed(1)}px, ` +
                `보정치: +${headTiltTolerance.toFixed(1)}px, ` +
                `기준: ${dynamicThreshold.toFixed(1)}px`
            );
        }

        if (diffX >= dynamicThreshold + 20) return POSTURE_STATUS.TURTLE_NECK_WARNING;
        if (diffX >= dynamicThreshold)       return POSTURE_STATUS.TURTLE_NECK_CAUTION;
    }

    return null;
};

/**
 * 기울어짐 판정 (TILTED)
 * 양쪽 어깨의 Y축 높이 차이(shoulderTilt)로 몸의 기울어짐 감지.
 * 측면 촬영 시에는 카메라 각도로 인해 어깨가 자연스럽게 기울어 보이므로 임계치 완화.
 *
 * [임계치 근거]
 * - 정면 WARNING 0.07 / CAUTION 0.03 : 정규화 좌표 기준 약 3.5cm / 1.5cm 차이
 * - 측면 WARNING 0.15 / CAUTION 0.10 : 측면에서는 원근 효과로 어깨 차이가 과장되므로 약 2배 완화
 *
 * @param {number} shoulderTilt - Math.abs(left_shoulder.y - right_shoulder.y)
 * @param {string} mode
 * @returns {string|null}
 */
const checkTiltedPosture = (shoulderTilt, mode) => {
    const isSideView           = mode.startsWith('SIDE');
    const tiltWarningThreshold = isSideView ? 0.15 : 0.07;
    const tiltCautionThreshold = isSideView ? 0.10 : 0.03;

    if (shoulderTilt >= tiltWarningThreshold) return POSTURE_STATUS.TILTED_WARNING;
    if (shoulderTilt >= tiltCautionThreshold) return POSTURE_STATUS.TILTED_CAUTION;
    return null;
};

/**
 * 엎드림 판정 (SLUMPED)
 * 코-어깨 Y축 오프셋(즉각 감지)과 영점 대비 코 하락 폭(정밀 판정)을 복합 사용.
 * 두 기준을 함께 사용하는 이유:
 * - noseShoulderYDiff 단독: 키가 큰 사람은 항상 값이 커서 오인식 가능
 * - calibration 보조: 영점 대비 상대적 변화량으로 더 정확하게 판정
 *
 * [임계치 근거]
 * - noseShoulderYDiff >= 0.04 : 코가 어깨 아래로 확실히 내려간 상태 (즉각 위험)
 * - calibration diffY >= 40px : 영점 대비 약 2.5cm 이상 하락 (위험)
 * - calibration diffY >= 18px : 약 1cm 이상 하락 (주의)
 * - noseShoulderYDiff >= 0.02 : 경미한 하락 보조 판정 (calibration 없을 때 대비)
 *
 * @param {Object}      nose
 * @param {string}      mode
 * @param {Object|null} calibration
 * @param {number}      noseShoulderYDiff - nose.y - shoulderYAvg (양수 = 코가 어깨 아래)
 * @returns {string|null}
 */
const checkSlumped = (nose, mode, calibration, noseShoulderYDiff) => {
    // 즉각 감지 — 코가 어깨보다 확실히 아래이면 캘리브레이션 없이도 즉시 위험
    if (noseShoulderYDiff >= 0.04) return POSTURE_STATUS.SLUMPED_WARNING;

    // 영점 기반 정밀 판정 (정면 한정 — 측면은 각도로 인해 오인식 가능)
    if (mode === 'FRONT_VIEW' && calibration?.noseY) {
        const diffY = (nose.y - calibration.noseY) * 480;
        if (diffY >= 40) return POSTURE_STATUS.SLUMPED_WARNING;
        if (diffY >= 18) return POSTURE_STATUS.SLUMPED_CAUTION;
    }

    // 보조 판정 — 즉각 기준 미달이지만 경미한 하락이 감지될 때
    if (noseShoulderYDiff >= 0.02) return POSTURE_STATUS.SLUMPED_CAUTION;

    return null;
};

// ─── 공개 API ────────────────────────────────────────────────────────────────

/**
 * 1. 카메라 위치 및 모드 감지 (어깨 너비 기반)
 * 어깨 두 점 사이의 유클리드 거리가 0.30 미만이면 측면 촬영으로 판단.
 * 임계치 0.30은 정면/측면 전환이 가장 자연스럽게 이루어지는 값으로 실험을 통해 도출.
 * (0.15 → 측면 과인식 문제, 0.25 → 경계 불안정 문제가 있어 0.30으로 결정)
 *
 * @param {Array} landmarks - MediaPipe Pose 랜드마크 배열
 * @returns {'FRONT_VIEW' | 'SIDE_LEFT' | 'SIDE_RIGHT'}
 */
const detect_camera_mode = (landmarks) => {
    if (!landmarks || landmarks.length < 13) return 'FRONT_VIEW';

    const left_shoulder  = landmarks[11];
    const right_shoulder = landmarks[12];

    // 양쪽 어깨 사이의 유클리드 거리 (정규화 좌표 기준)
    const shoulderWidth = euclideanDist(left_shoulder, right_shoulder);

    // shoulderWidth < 0.30이면 측면 촬영으로 간주
    // 좌우 구분: 정면에서는 왼쪽 어깨.x > 오른쪽 어깨.x (카메라 미러 효과)
    const mode = shoulderWidth < 0.30
        ? (left_shoulder.x > right_shoulder.x ? 'SIDE_RIGHT' : 'SIDE_LEFT')
        : 'FRONT_VIEW';

    if (DEBUG) console.log(`[모드 감지] 어깨너비: ${shoulderWidth.toFixed(3)}, 판정모드: ${mode}`);

    return mode;
};

/**
 * 2. 주변 소음 수준 분석
 *
 * [경계값 설계 근거 - 국가 소음 정보 및 생리학적 연구 기반]
 *
 * - QUIET  (50dB 미만) : 도서관(40dB) ~ 조용한 사무실(50dB) 수준. 집중에 적합한 환경.
 *
 * - NORMAL (50~69dB)   : 교실 안(50dB) ~ 일반 대화(60dB) 수준. 집중력 저하가 시작되는 시점.
 *   → 왜 50dB부터인가?
 *     국가 소음 정보에 따르면 50dB부터 맥박수 변화와 계산력 저하가 생리학적으로 증명됨.
 *   → 왜 60dB에서 알림을 주는가?
 *     일반 대화 수준(60dB)이 지속되면 뇌가 소리를 '의식'하기 시작해 집중의 항상성이 깨짐.
 *     단, 50~60dB 구간은 즉시 위험은 아니므로 'NORMAL' 단계로 구분해 경보가 아닌 안내 수준으로 처리.
 *
 * - NOISY  (70dB 이상) : 15m 거리 자동차 소음(70dB) ~ 도시 교통 소음(80dB). 집중이 불가능한 환경.
 *   → 70dB 이상은 WHO 기준 장시간 노출 시 청각 손상 위험 구간이기도 함.
 *
 * @param {number} decibel - 마이크에서 측정된 현재 소음 레벨 (dB)
 * @returns {'NOISY' | 'NORMAL' | 'QUIET'}
 */
const analyze_noise_level = (decibel) => {
    if (decibel >= 70) return 'NOISY';
    if (decibel >= 50) return 'NORMAL';
    return 'QUIET';
};

/**
 * 3. 사용자 이탈 체크 (주요 랜드마크 가시성 확인)
 * visibility > 0.7은 MediaPipe 공식 권장 신뢰도 기준.
 * 0.7 미만이면 랜드마크가 추정값으로 채워질 가능성이 높아 자세 판정 오류 증가.
 * 코, 양쪽 어깨 3개가 모두 통과해야 사용자가 있다고 판단.
 *
 * @param {Array} landmarks
 * @returns {boolean}
 */
const check_user_presence = (landmarks) => {
    if (!landmarks || landmarks.length < 13) return false;
    const nose           = landmarks[0];
    const left_shoulder  = landmarks[11];
    const right_shoulder = landmarks[12];
    return (
        nose.visibility          > 0.7 &&
        left_shoulder.visibility > 0.7 &&
        right_shoulder.visibility > 0.7
    );
};

/**
 * 4. 세부 자세 분석 (메인 판정 함수)
 * 각 자세 판정은 독립된 서브 함수로 분리되어 있으며 우선순위 순서로 실행됨.
 * 하나라도 나쁜 자세가 감지되면 즉시 반환 (|| 단락 평가).
 * 모두 정상이면 부동 자세 여부를 최종 확인 후 GOOD_POSTURE 반환.
 *
 * [판정 우선순위]
 * 1. 손 관련 (HAND_NEAR_FACE, LEANING_ON_HAND) — 즉각적 행동 교정 필요
 * 2. 거북목 (TURTLE_NECK) — 장기 건강 위험
 * 3. 기울어짐 (TILTED)    — 척추 좌우 불균형
 * 4. 엎드림 (SLUMPED)     — 목/허리 복합 부담
 * 5. 부동 자세 (STATIC)   — 오래 앉아있는 것 자체의 위험 (우선순위 낮음)
 *
 * @param {Array}       landmarks     - MediaPipe Pose 랜드마크
 * @param {string}      mode          - detect_camera_mode 결과
 * @param {Object|null} calibration   - 정자세 기준값 { noseY, sideDistX, baseEarDist }
 * @param {Array|null}  faceLandmarks - Face Mesh 랜드마크 (선택, 152번 턱끝 활용)
 * @returns {string} POSTURE_STATUS 중 하나
 */
const analyze_posture = (landmarks, mode = 'FRONT_VIEW', calibration = null, faceLandmarks = null) => {
    if (!landmarks || landmarks.length < 17) return POSTURE_STATUS.UNKNOWN;

    const nose           = landmarks[0];
    const left_shoulder  = landmarks[11];
    const right_shoulder = landmarks[12];

    // 부동 자세 타이머는 매 프레임 갱신해야 하므로 다른 판정보다 먼저 호출
    const now         = performance.now();
    const staticAlert = updateStaticTracking(nose, now);

    // [가시성 체크 1] 어깨는 보이는데 코가 안 보이면 엎드린 것으로 간주
    // 배경 인물을 잘못 인식한 경우도 이 조건으로 걸러냄
    if (left_shoulder.visibility > 0.5 && right_shoulder.visibility > 0.5) {
        if (nose.visibility < 0.3) return POSTURE_STATUS.SLUMPED_WARNING;
    }

    // [가시성 체크 2] 핵심 랜드마크가 완전히 안 보이면 판정 자체가 불가
    if (nose.visibility < 0.1 || left_shoulder.visibility < 0.1 || right_shoulder.visibility < 0.1) {
        return POSTURE_STATUS.UNKNOWN;
    }

    const shoulderYAvg      = (left_shoulder.y + right_shoulder.y) / 2;
    const noseShoulderYDiff = nose.y - shoulderYAvg; // 양수일수록 코가 어깨 아래 (엎드림)
    const shoulderTilt      = Math.abs(left_shoulder.y - right_shoulder.y);

    // 우선순위 순서로 판정 — 하나라도 감지되면 즉시 반환
    return (
        checkHandPosture(landmarks, nose, faceLandmarks)          ||
        checkTurtleNeck(mode, landmarks, calibration)             ||
        checkTiltedPosture(shoulderTilt, mode)                    ||
        checkSlumped(nose, mode, calibration, noseShoulderYDiff)  ||
        staticAlert                                               ||
        POSTURE_STATUS.GOOD_POSTURE
    );
};

/**
 * 5. 맞춤형 코칭 메시지 생성
 * COACHING_MESSAGES 상수로 상태→메시지를 매핑해 호출마다 객체를 재생성하지 않음.
 * 새로운 자세 상태가 추가될 때 COACHING_MESSAGES만 수정하면 됨.
 *
 * [우선순위]
 * 1. 나쁜 자세가 있으면 해당 자세 메시지 반환
 * 2. 자세는 정상이지만 주변 소음이 위험 수준이면 소음 안내
 * 3. 모두 정상이면 긍정 메시지 반환
 *
 * @param {string} posture_status - POSTURE_STATUS 상수 중 하나
 * @param {string} noise_status   - 'NOISY' | 'NORMAL' | 'QUIET'
 * @returns {string}
 */
const get_coaching_message = (posture_status, noise_status) => {
    const postureMessage = COACHING_MESSAGES[posture_status];

    // 나쁜 자세가 있으면 해당 메시지 우선 반환
    if (postureMessage && posture_status !== POSTURE_STATUS.GOOD_POSTURE) {
        return postureMessage;
    }

    // 자세는 정상이지만 소음이 시끄러운 경우
    if (noise_status === 'NOISY') {
        return '주변이 조금 시끄럽네요. 이어폰 착용을 추천드려요.';
    }

    return COACHING_MESSAGES[POSTURE_STATUS.GOOD_POSTURE];
};

module.exports = {
    detect_camera_mode,
    analyze_noise_level,
    check_user_presence,
    analyze_posture,
    get_coaching_message,
    reset_static_tracking,
};
