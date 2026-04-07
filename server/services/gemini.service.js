const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const POSE_LABEL_MAP = {
  GOOD_POSTURE: '좋은 자세',
  NORMAL: '정상 자세',
  TURTLE_NECK: '거북목 자세',
  LEANING_ON_HAND: '턱을 괴는 자세',
  TILTED_CAUTION: '몸이 기울어진 자세',
};

/**
 * Gemini API 호출 실패 시 세션 데이터 기반으로 자체 피드백을 생성합니다.
 * @param {Object} sessionData - 세션 데이터
*/

function generateFallbackFeedback({ totalSeconds, immScore, avgDecibel, poseSummary }) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const timeText = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  // 점수 기반 총평
  const 총평 = immScore >= 80
    ? `${timeText} 동안 높은 집중력을 유지했어요. 오늘의 세션은 성공적이었습니다.`
    : `${timeText} 동안 집중 세션을 완료했어요. 꾸준한 노력이 성장을 만듭니다.`;

  // 긍정 분석
  const 긍정 = `총 ${timeText} 집중했으며, 몰입도 점수는 ${immScore}점이에요. ` +
    (avgDecibel < 50
      ? `주변 소음이 ${avgDecibel}dB로 조용한 환경에서 집중할 수 있었어요.`
      : `평균 소음 ${avgDecibel}dB 환경에서도 집중을 유지한 점이 인상적이에요.`);

  // 자세 불량 건수
  const badPoses = poseSummary
    ? poseSummary.filter(p => p.pose_status !== 'GOOD_POSTURE' && p.pose_status !== 'NORMAL')
    : [];

  const totalBadCount = badPoses.reduce((sum, p) => sum + Number(p.count), 0);

  // 보완 사항
  const 보완 = totalBadCount > 0
    ? `자세 불량이 총 ${totalBadCount}회 감지되었어요. 허리를 곧게 펴고 모니터와의 거리를 유지해보세요.`
    : `자세 불량이 감지되지 않았어요. 올바른 자세 습관을 계속 유지해주세요.`;

  // 태그
  const 태그 = [
    immScore >= 80 ? '#성공적_집중' : '#집중력_향상중',
    totalBadCount === 0 ? '#자세_완벽' : '#자세주의',
    avgDecibel < 50 ? '#조용한_환경' : '#소음_극복'
  ].join(' ');

  return {
    오늘의총평: 총평,
    긍정분석: 긍정,
    보완사항: 보완,
    집중태그: 태그
  };
}
/**
 * 세션 데이터를 바탕으로 Gemini AI 피드백을 생성합니다.
 * @param {Object} sessionData - 세션 데이터
 * @param {number} sessionData.totalSeconds - 총 집중 시간(초)
 * @param {number} sessionData.immScore - 몰입도 점수
 * @param {number} sessionData.avgDecibel - 평균 소음(dB)
 * @param {Array}  sessionData.poseSummary - 자세 기록 [{ pose_status, count }]
 */

async function generateFeedback(sessionData) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const { totalSeconds, immScore, avgDecibel, poseSummary } = sessionData;

    // 집중 시간 변환
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const timeText = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

    // 자세 기록 텍스트 변환
    const poseText = poseSummary && poseSummary.length > 0
      ? poseSummary
        .filter(p => p.pose_status !== 'GOOD_POSTURE' && p.pose_status !== 'NORMAL')
        .map(p => `${POSE_LABEL_MAP[p.pose_status] || p.pose_status}: ${p.count}회`)
        .join(', ')
      : '자세 불량 없음';

    const prompt = `
당신은 'Smart Focus' 서비스의 [전문 학습 코치]입니다.
사용자의 집중 데이터와 자세 분석 로그를 종합하여 리포트용 피드백을 생성하되,
다음 [비율 지침]을 엄격히 준수하십시오.

[오늘의 세션 데이터]
- 집중 시간: ${timeText}
- 몰입도 점수: ${immScore}점
- 평균 소음: ${avgDecibel}dB
- 자세 기록: ${poseText}

[비율 지침]
1. 성취와 격려 (70%): 사용자가 달성한 집중 시간, 몰입도 점수, 소음 관리 지표 등
                      '긍정적인 지표'를 구체적인 수치와 함께 먼저 언급하십시오.
                      과거 평균 데이터와 비교하여 개선된 점이 있다면 수치로 칭찬하십시오.
2. 분석과 보완 (30%): 자세 불량 발생 빈도나 집중력이 저하된 구간을 데이터 근거로 지적하십시오.
                      이를 해결할 전문적인 행동 지침을 제시하십시오.

[답변 원칙]
- 말투: 차분하고 신뢰감 있는 '해요체'를 사용하되, 전문 용어를 적절히 섞어 권위를 유지하십시오.
- 일관성: 동일한 세션 데이터에 대해서는 항상 논리적으로 일관된 진단을 내리십시오.
- 금지사항: 너무 가벼운 유행어나 감정적인 과잉 표현(예: "너무너무 대단해요!")은 사용하지 마십시오.
- 자세 상태명은 사용자에게 보이는 자연스러운 한국어 표현으로 바꿔 작성할 것
- GOOD_POSTURE, NORMAL, TURTLE_NECK 같은 내부 코드명은 응답에 직접 쓰지 말 것
- 모든 문장은 사용자용 자연스러운 한국어로만 작성할 것
[출력 형식]
반드시 아래의 한국어 키를 가진 JSON 구조로만 응답하십시오.
{
  "오늘의총평": "오늘의 성취를 정의하는 한 줄 평",
  "긍정분석": "과거 기록 대비 개선점 및 잘한 점에 대한 상세 데이터 분석 (전체의 70% 분량)",
  "보완사항": "자세/집중력 분석 및 아쉬운 점과 내일을 위한 개선 제안 (전체의 30% 분량)",
  "집중태그": "#성장중 #성공적_몰입 #자세주의 등 데이터 맞춤형 태그"
}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // JSON 파싱 (```json 같은 마크다운 제거)
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return parsed;
  } catch (error) {
    console.error('[GEMINI ERROR]', error);
    return generateFallbackFeedback(sessionData);
  }
}

module.exports = {
  generateFeedback,
};