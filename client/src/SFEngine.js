/**
 * ============================================================
 * [Smart Focus] 통합 분석 엔진
 * ============================================================
 *
 * [시스템 개요]
 * 매 프레임 MediaPipe Pose 랜드마크 데이터와 마이크 dB 값을 받아
 * 자세 상태(GOOD / CAUTION / WARNING)와 소음 상태를 반환하는 분석 엔진.
 * 카메라가 정면인지 측면인지, 측면이라면 왼쪽/오른쪽인지까지
 * 내부에서 자동 판별하므로 외부에서 별도로 모드를 넘길 필요 없음.
 *
 * [판정 근거 출처]
 * - 자세(거북목/하중) : 질병관리청(KCDC)
 * - 소음              : CDC 산하 NIOSH / 국가소음정보시스템
 * - 정자세/기울어짐   : 정재헌 외 3인, 「MediaPipe 기반 실시간 학습 자세 인식 및 교정 피드백 시스템」, 2025.
 * - 부동 자세         : 고용노동부 VDT 작업 지침 / 뽀모도로 기법
 * - 측면 판별 방법론  : LearnOpenCV MediaPipe 자세 분석 연구
 *
 * ============================================================
 * [Table 1. Range of angles for each posture type — 논문 기준값]
 * ============================================================
 * │ 정자세(GOOD)   │ 기울기 < 0.05  AND  -0.05 < 머리위치 < 0.1
 * │ 기울어짐(TILT) │ 기울기 ≥ 0.05 (0.03 이상부터 CAUTION)
 * │ 엎드림(SLUMP)  │ 머리위치 ≤ -0.1 (-0.05 이하부터 CAUTION)
 * ============================================================
 */

// ============================================================
// 모듈 스코프 상태 변수 (프레임이 지나도 유지됨)
// ============================================================
let lastNosePos = null;             // 직전 프레임의 코(lm[0]) 위치 기억
let staticCheckStart = Date.now();  // 부동 자세 타이머 시작점

/**
 * [세션 초기화 함수] — 포커스 세션 시작 시 반드시 호출
 * 이전 세션의 타이머가 이어져서 "30분 부동"으로 오판정되는 것을 방지함.
 */
export function resetStaticTracking() {
    lastNosePos = null;
    staticCheckStart = Date.now();
}

/**
 * [카메라 모드 자동 판별]
 * 양쪽 어깨(11, 12)의 x축 간격(offset)으로 정면/측면을 구분함.
 * offset ≥ 0.15 이면 정면, 미만이면 측면으로 판별.
 */
function detectCameraMode(landmarks) {
    const offset = Math.sqrt(
        Math.pow(landmarks[11].x - landmarks[12].x, 2) +
        Math.pow(landmarks[11].y - landmarks[12].y, 2)
    );
    if (offset >= 0.15) return 'front';
    // 왼쪽 어깨가 오른쪽 어깨보다 화면 왼쪽에 있으면 왼쪽에서 찍은 것
    return landmarks[11].x < landmarks[12].x ? 'side-left' : 'side-right';
}

/**
 * [소음 판정]
 * 50dB 이상: 생리적 변화 시작 (CAUTION) / 60dB 이상: 뇌 정보 인식 (msg 변경)
 * 70dB 이상: 자동차 소음 수준으로 집중 불가 (WARNING)
 */
function evaluateNoise(db) {
    if (db >= 70) {
        return { status: 'WARNING', val: db, msg: '70dB 이상: 집중 불가 (자동차 소음 수준)' };
    }
    if (db >= 50) {
        return {
            status: 'CAUTION',
            val: db,
            msg: db >= 60 ? '60dB 이상: 뇌 정보 인식 시점 — 집중 환경 개선 필요' : '50dB 이상: 생리적 변화 시작',
        };
    }
    return { status: 'NORMAL', val: db };
}

/**
 * [부동 자세 판정]
 * 코끝(lm[0])의 이동량이 화면의 5%(0.05) 미만인 상태가 장시간 지속되는지 검사.
 * 20분 이상: CAUTION (사전 예고) / 30분 이상: WARNING (본 알림)
 */
function evaluateStatic(noseLm) {
    const now = Date.now();
    const staticTime = now - staticCheckStart;

    // 20분(1,200,000ms) 미만이면 판정 통과
    if (staticTime < 1200000) return null;

    // 코끝의 2D 유클리드 이동 거리 계산
    const move = lastNosePos
        ? Math.sqrt(Math.pow(noseLm.x - lastNosePos.x, 2) + Math.pow(noseLm.y - lastNosePos.y, 2))
        : 1;

    // 화면의 5% 이상 이동했으면 움직인 것으로 판단하여 타이머 리셋
    if (move >= 0.05) {
        lastNosePos = { x: noseLm.x, y: noseLm.y };
        staticCheckStart = now;
        return null;
    }

    return {
        type: 'STATIC',
        status: staticTime >= 1800000 ? 'WARNING' : 'CAUTION',
    };
}

/**
 * [V2 턱 괴기 판정]
 * Face Mesh의 152번(턱끝) 데이터를 활용하여 손목과의 거리를 계산.
 * 얼굴 크기(faceHeight) 대비 손목과 턱의 거리가 10% 미만이면 WARNING.
 */
function evaluateChinRest(poseLandmarks, faceLandmarks) {
    let chinApprox;
    
    // V2: Face Mesh 데이터가 넘어오면 정밀한 턱끝(152) 사용, 없으면 입꼬리(9,10) 평균 사용
    if (faceLandmarks && faceLandmarks[152]) {
        chinApprox = { x: faceLandmarks[152].x, y: faceLandmarks[152].y };
    } else {
        chinApprox = {
            x: (poseLandmarks[9].x + poseLandmarks[10].x) / 2,
            y: (poseLandmarks[9].y + poseLandmarks[10].y) / 2,
        };
    }

    const faceHeight = Math.abs(poseLandmarks[0].y - chinApprox.y);
    if (faceHeight < 0.001) return null; // 오류 방지

    // 양쪽 손목에서 턱까지의 거리 중 더 가까운 쪽 기준
    const distL = Math.sqrt(Math.pow(poseLandmarks[15].x - chinApprox.x, 2) + Math.pow(poseLandmarks[15].y - chinApprox.y, 2));
    const distR = Math.sqrt(Math.pow(poseLandmarks[16].x - chinApprox.x, 2) + Math.pow(poseLandmarks[16].y - chinApprox.y, 2));
    const ratio = Math.min(distL, distR) / faceHeight;

    if (ratio < 0.10) return { type: 'CHIN', status: 'WARNING' }; // 턱 완전 접촉
    if (ratio < 0.15) return { type: 'CHIN', status: 'CAUTION' }; // 무게 중심 이동 단계
    return null;
}

/**
 * [엎드림 / 거북목 / 기울어짐 / 정자세 판정]
 * 카메라 모드(정면/측면)에 따라 다른 알고리즘으로 자세 분석.
 */
function evaluatePose(landmarks, calibration, mode) {
    // 공통 수식: 머리 위치 편차(음수가 클수록 엎드림) / 어깨 기울기
    const h_offset = landmarks[0].y - (landmarks[11].y + landmarks[12].y) / 2;
    const s_slope  = Math.abs(landmarks[11].y - landmarks[12].y);

    // 1. 엎드림(SLUMP) 판정
    if (h_offset <= -0.1)  return { type: 'SLUMP', status: 'WARNING' };
    if (h_offset <= -0.05) return { type: 'SLUMP', status: 'CAUTION' };

    // 2. 측면 모드 거북목 판정 (카메라에 가까운 귀-어깨 x축 거리 활용)
    if (mode === 'side-left' || mode === 'side-right') {
        const earIdx      = mode === 'side-left' ? 7  : 8;
        const shoulderIdx = mode === 'side-left' ? 11 : 12;
        const distX = Math.abs(landmarks[earIdx].x - landmarks[shoulderIdx].x) * 1000;
        
        if (distX >= 50) return { type: 'TURTLE', status: 'WARNING', load: '27kg' };
        if (distX >= 25) return { type: 'TURTLE', status: 'CAUTION', load: '12kg' };
        return { type: 'NORMAL', status: 'NORMAL' };
    }

    // 3. 정면 모드 거북목 및 기울어짐 판정
    if (mode === 'front') {
        // 영점 조절 시점(calibration) 대비 현재 귀-어깨 거리 비율
        const ratio = Math.abs(landmarks[7].y - landmarks[11].y) / (calibration?.distY || 0.12);
        
        if (ratio <= 0.7)  return { type: 'TURTLE', status: 'WARNING', load: '18kg 이상' };
        if (ratio <= 0.85) return { type: 'TURTLE', status: 'CAUTION', load: '12kg' };
        
        if (s_slope >= 0.05) return { type: 'TILT', status: 'WARNING' };
        if (s_slope >= 0.03) return { type: 'TILT', status: 'CAUTION' };

        // Table 1 기준 4가지 조건 동시 만족 시 정자세(GOOD) 판정
        const isGoodPosture = s_slope < 0.05 && h_offset > -0.05 && h_offset < 0.1 && ratio > 0.85;
        if (isGoodPosture) {
            return { type: 'NORMAL', status: 'GOOD', msg: '바른 자세입니다' };
        }
    }

    return { type: 'NORMAL', status: 'NORMAL' };
}

/**
 * [메인 엔진 함수] — 프론트엔드에서 매 프레임 호출
 * 위 모든 판정 함수를 조합하여 최종 우선순위에 따른 결과를 반환.
 */
export function evaluateSmartFocus(data, calibration) {
    const { landmarks, faceLandmarks, db } = data;
    
    // 랜드마크 미검출 시 튕김 방지용 기본값
    const defaultResult = {
        mode:  'front',
        pose:  { type: 'NORMAL', status: 'NORMAL', load: '5kg' },
        noise: { status: 'NORMAL', val: db },
    };
    if (!landmarks || !landmarks[0]) return defaultResult;

    const mode = detectCameraMode(landmarks);
    const noiseResult = evaluateNoise(db);

    // 우선순위 1: 부동 자세 (WARNING 시 즉시 반환)
    const staticResult = evaluateStatic(landmarks[0]);
    if (staticResult?.status === 'WARNING') {
        return { mode, pose: staticResult, noise: noiseResult };
    }

    // 우선순위 2: 턱 괴기 (WARNING 시 즉시 반환)
    const chinResult = evaluateChinRest(landmarks, faceLandmarks);
    if (chinResult?.status === 'WARNING') {
        return { mode, pose: chinResult, noise: noiseResult };
    }

    // 우선순위 3: 엎드림 / 거북목 / 기울어짐
    const poseResult = evaluatePose(landmarks, calibration, mode);
    
    // CAUTION 단계 병합: 턱 괴기 경고가 있으면 거북목보다 우선 표시
    const finalPose = chinResult ?? poseResult;

    return { mode, pose: finalPose, noise: noiseResult };
}