import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

import { immersionApi } from '../shared/api';

/**
 * [종합 분석 리포트]
 * - 다크모드 전역 테마 동기화 및 Chart.js 시인성 대응 완료
 * - [버그 수정] 백엔드에서 객체(Object) 타입으로 AI 피드백을 반환할 때 발생하는 JSON 파싱 에러 방지
 * - 차트 데이터 누락 시 배열(Array) 매핑 에러를 방지하는 방어 로직 적용
 */
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const NOISE_LABEL_MAP = {
  'ambient': '생활 소음', 'speech': '대화 소음', 'music': '음악 소음',
  'construction': '공사 소음', 'traffic': '교통 소음', 'none': '방해 없음'
};

const POSE_DETAIL_MAP = {
  'TILTED_WARNING': { label: '고개 기울임 위험', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50' },
  'TILTED_CAUTION': { label: '고개 기울임 주의', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50' },
  'LEANING_ON_HAND': { label: '턱 괴기 감지', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/50' },
  'TURTLE_NECK': { label: '거북목 주의', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50' },
  'TURNING_HEAD': { label: '시선 이탈', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50' },
  'PHONE_USAGE': { label: '스마트폰 사용', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50' },
  'NORMAL': { label: '정상 자세', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50' },
  'GOOD_POSTURE': { label: '바른 자세 유지', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50' },
  'HAND_NEAR_FACE_CAUTION': { label: '얼굴 주변 손 감지', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50' },
  'SLUMPED_WARNING': { label: '구부정한 자세 위험', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50' },
  'SLUMPED_CAUTION': { label: '자세 낮아짐 주의', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50' },
  'STATIC_WARNING': { label: '장시간 부동 자세', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50' },
  'STATIC_CAUTION': { label: '부동 자세 주의', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50' },
  'TURTLE_NECK_WARNING': { label: '거북목 위험', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50' },
  'TURTLE_NECK_CAUTION': { label: '거북목 주의', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50' }
};

/* 초 단위 누적 시간을 한국어 시/분/초 표현으로 변환하는 유틸리티 */
const formatSecondsToKoreanTime = (totalSeconds) => {
  if (!totalSeconds || totalSeconds === 0) return '0초';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  let result = '';
  if (hours > 0) result += `${hours}시간 `;
  if (minutes > 0) result += `${minutes}분 `;
  if (seconds > 0 || result === '') result += `${seconds}초`;
  return result.trim();
};

export default function Report() {
  const navigate = useNavigate();
  const { imm_idx } = useParams();
  const isDetailsMode = !!imm_idx && imm_idx !== 'undefined';
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [fullHistory, setFullHistory] = useState([]);

  /* 데이터 패칭 및 AI 피드백 파싱 */
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const userInfo = JSON.parse(localStorage.getItem('user_info'));
        if (!userInfo) return navigate('/login');

        if (!isDetailsMode) {
          const historyResponse = await immersionApi.getHistory(userInfo.user_idx);
          if (historyResponse.success) setFullHistory(historyResponse.data || []);
          return;
        }

        const detailResponse = await immersionApi.getReportDetail(imm_idx);
        if (detailResponse.success && detailResponse.data) {
          const { session, noise_summary, pose_summary, chart_data } = detailResponse.data;
          const totalSecs = session.total_seconds || 0;

          // pose_summary 각 항목을 표시용 정보로 변환한다.
          // POSE_DETAIL_MAP에 없는 코드는 코드명 그대로 표시하고 기본 스타일을 사용한다.
          const detailedPoses = pose_summary?.filter(pose => pose.count > 0).map(pose => ({
            status: pose.pose_status,
            label: POSE_DETAIL_MAP[pose.pose_status]?.label || pose.pose_status,
            count: pose.count,
            formattedTime: formatSecondsToKoreanTime(pose.count),
            color: POSE_DETAIL_MAP[pose.pose_status]?.color || 'text-slate-600',
            bg: POSE_DETAIL_MAP[pose.pose_status]?.bg || 'bg-slate-50 border-slate-100'
          })) || [];

          const totalWarningSeconds = detailedPoses
            .filter(pose => !['NORMAL', 'GOOD_POSTURE'].includes(pose.status))
            .reduce((sum, pose) => sum + pose.count, 0);

          let aiFeedback = {
            오늘의총평: "분석 데이터를 구성하고 있습니다.",
            긍정분석: "세션 기록 정상 완료",
            보완사항: "다음 측정은 1분 이상 유지해 보세요.",
            집중태그: "#집중"
          };

          if (session.ai_feedback) {
            try {
              // [버그 수정] 백엔드에서 JSON 문자열 대신 Object로 넘어올 때 발생하는 파싱 에러 방어.
              // DB에서 JSON 문자열로 저장했더라도 mysql2가 자동 파싱해서 Object로 반환하는 경우가 있다.
              const parsed = typeof session.ai_feedback === 'string'
                ? JSON.parse(session.ai_feedback)
                : session.ai_feedback;

              if (typeof parsed === 'object' && parsed !== null) {
                // 키값이 누락된 상태로 넘어올 경우를 대비해 기존 기본값 객체에 병합한다.
                aiFeedback = { ...aiFeedback, ...parsed };
              } else {
                throw new Error("Invalid Format");
              }
            } catch (err) {
              // 예외 상황에서 문자열 전용 메서드(.includes)를 남발하지 않도록 타입 검사를 추가한다.
              const isErrorMsg = typeof session.ai_feedback === 'string' && session.ai_feedback.includes("오류");
              aiFeedback.오늘의총평 = isErrorMsg ? "AI 분석 생성 실패" : "피드백 처리 중 문제가 발생했습니다.";
            }
          }

          // 차트 데이터가 배열 형태가 아닐 경우 map() 호출로 인한 에러를 방어한다.
          const chartLabels = Array.isArray(chart_data) ? chart_data.map(d => d.time_label) : [];
          const chartScores = Array.isArray(chart_data) ? chart_data.map(d => d.imm_score) : [];
          const chartNoises = Array.isArray(chart_data) ? chart_data.map(d => d.decibel) : [];

          setReportData({
            summary: {
              date: session.imm_date,
              time: formatSecondsToKoreanTime(totalSecs),
              score: session.imm_score || 0,
              warningTime: formatSecondsToKoreanTime(totalWarningSeconds),
              mainNoise: NOISE_LABEL_MAP[noise_summary?.main_obstacle] || "방해 없음",
              aiFeedback
            },
            chart: { labels: chartLabels, scores: chartScores, noises: chartNoises },
            poseBreakdown: detailedPoses
          });
        }
      } catch (err) {
        console.error('[REPORT FETCH ERROR]', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, [imm_idx, isDetailsMode, navigate]);

  if (isLoading) return <div className="min-h-[85vh] flex flex-col items-center justify-center gap-4"><div className="w-12 h-12 border-4 border-[#5B44F2] border-t-transparent rounded-full animate-spin"></div><p className="text-slate-500 dark:text-slate-400 font-black animate-pulse transition-colors">분석 리포트를 불러오는 중...</p></div>;

  if (isDetailsMode && !reportData) return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center gap-6">
      <div className="text-6xl text-slate-200 dark:text-slate-700">🔍</div>
      <div className="text-center"><h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">리포트를 찾을 수 없습니다</h3><p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">기록이 유실되었거나 분석 중인 세션입니다.</p></div>
      <button onClick={() => navigate('/report')} className="px-8 py-3 bg-[#5B44F2] text-white rounded-2xl font-black shadow-lg">보관함으로 돌아가기</button>
    </div>
  );

  /* 리포트 보관함 (리스트 모드) */
  if (!isDetailsMode) return (
    <div className="max-w-[1400px] mx-auto min-h-[90vh] p-10 font-sans animate-fade-in text-slate-900 dark:text-white transition-colors">
      <div className="flex justify-between items-end mb-10 pb-6 border-b border-slate-200/60 dark:border-slate-800/60">
        <div><h2 className="text-3xl font-black mb-1 tracking-tighter">분석 리포트 보관함</h2><p className="text-slate-500 dark:text-slate-400 font-medium">과거의 집중 기록을 한눈에 비교하세요.</p></div>
        <div className="px-5 py-2 bg-[#5B44F2]/10 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-sm font-bold text-[#5B44F2] dark:text-indigo-400">총 {fullHistory.length}회의 기록</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {fullHistory.map((session, index) => (
          <div key={index} onClick={() => navigate(`/report/${session.imm_idx}`)} className="p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 transition-all hover:shadow-xl hover:-translate-y-2 cursor-pointer group shadow-sm flex flex-col h-full backdrop-blur-sm">
            <div className="flex justify-between items-center mb-8"><span className="font-extrabold text-slate-700 dark:text-slate-200 tracking-tighter">{new Date(session.imm_date).toLocaleDateString()}</span><span className="text-sm font-black text-[#5B44F2] dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50">{session.imm_score}pt</span></div>
            <div className="text-sm text-slate-500 dark:text-slate-400 font-semibold space-y-4 mt-auto">
              <p className="flex justify-between border-b border-slate-50 dark:border-slate-800/50 pb-2"><span>시작 시각</span><span className="text-slate-900 dark:text-slate-200">{session.start_time?.substring(0, 5)}</span></p>
              <p className="flex justify-between border-b border-slate-50 dark:border-slate-800/50 pb-2"><span>집중 시간</span><span className="text-slate-900 dark:text-slate-200">{session.formatted_time || '0분'}</span></p>
              <p className="flex justify-between"><span>자세 이탈</span><span className="text-rose-500 dark:text-rose-400">{formatSecondsToKoreanTime(session.pose_count)}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* 리포트 상세 모드 */
  // 요약 카드 데이터는 배열로 정의하여 반복 렌더링한다.
  // 이유: 4개의 카드가 구조가 동일하므로 하나의 map()으로 처리하면 JSX 중복을 제거할 수 있다.
  const summaryCards = [
    { label: '총 집중 시간', value: reportData.summary.time, icon: '⏱️', colorClass: 'text-[#5B44F2] dark:text-indigo-400', bgClass: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { label: '집중 에너지', value: reportData.summary.score + 'pt', icon: '⚡', colorClass: 'text-emerald-500 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: '자세 이탈 시간', value: reportData.summary.warningTime, icon: '🚨', colorClass: 'text-rose-500 dark:text-rose-400', bgClass: 'bg-rose-50 dark:bg-rose-900/30' },
    { label: '주요 방해 소음', value: reportData.summary.mainNoise, icon: '🎧', colorClass: 'text-amber-500 dark:text-amber-400', bgClass: 'bg-amber-50 dark:bg-amber-900/30' }
  ];

  return (
    <div className="max-w-[1400px] mx-auto min-h-[90vh] p-10 font-sans animate-fade-in selection:bg-indigo-100 dark:selection:bg-indigo-900/50 text-slate-900 dark:text-white transition-colors">
      <header className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-end mb-8 pb-6 border-b border-slate-200/60 dark:border-slate-800/60 gap-4 sm:gap-0">
        <div>
          <button onClick={() => navigate('/report')} className="text-xs font-black text-[#5B44F2] dark:text-indigo-400 mb-3 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-lg transition-colors w-fit">← 보관함으로 돌아가기</button>
          <h2 className="text-3xl font-black tracking-tighter">종합 분석 리포트</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">사용자님의 집중 패턴을 AI가 정밀 분석했습니다.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {summaryCards.map((card, index) => (
          <div key={index} className="bg-white dark:bg-slate-900/50 p-7 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6 transition-all hover:shadow-xl hover:-translate-y-1 backdrop-blur-sm">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-inner border border-white/50 dark:border-white/5 ${card.bgClass} ${card.colorClass}`}>{card.icon}</div>
            <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-widest">{card.label}</p><p className="text-2xl font-black tracking-tight truncate">{card.value}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        <div className="lg:col-span-6 h-full">
          {/* AI 피드백 카드는 자체 그라데이션이 있으므로 다크모드에서도 톤 유지 (테두리만 조정) */}
          <div className="h-full p-10 rounded-[2.5rem] shadow-xl bg-gradient-to-br from-[#5B44F2] via-[#7c3aed] to-[#d946ef] text-white relative overflow-hidden transition-all hover:shadow-2xl group border border-transparent dark:border-indigo-500/20">
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/20 rounded-full blur-[80px] pointer-events-none group-hover:scale-110 duration-1000"></div>
            <div className="relative z-10 flex items-center gap-4 mb-10">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 text-3xl shadow-lg font-bold">🧠</div>
              <h3 className="text-xs font-black uppercase tracking-widest drop-shadow-md">AI 집중 코치 피드백</h3>
            </div>
            <div className="relative z-10 flex-1 flex flex-col justify-center gap-8">
              <p className="text-2xl md:text-3xl font-black leading-tight break-keep drop-shadow-md tracking-tight">"{reportData.summary.aiFeedback.오늘의총평}"</p>
              <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-8 border border-white/20 text-[15px] font-semibold space-y-6 shadow-inner">
                <p className="flex items-start gap-3"><span>💡</span><span className="pt-0.5">{reportData.summary.aiFeedback.긍정분석}</span></p>
                <div className="w-full h-px bg-white/10"></div>
                <p className="flex items-start gap-3"><span>🎯</span><span className="pt-0.5">{reportData.summary.aiFeedback.보완사항}</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 h-full">
          <div className="bg-white dark:bg-slate-900/50 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm h-full transition-all hover:shadow-xl text-slate-900 dark:text-white backdrop-blur-sm">
            <h3 className="text-lg font-black mb-8 flex items-center gap-3 tracking-tight"><span className="w-2 h-6 bg-[#5B44F2] dark:bg-indigo-400 rounded-full"></span>자세 정밀 분석 <span className="text-xs text-slate-400 dark:text-slate-500 font-normal ml-2 tracking-widest">(누적 유지 시간)</span></h3>
            <div className="space-y-4">
              {reportData.poseBreakdown.length > 0 ? reportData.poseBreakdown.map((pose, index) => (
                <div key={index} className={`flex justify-between items-center p-5 rounded-2xl ${pose.bg} border transition-all hover:border-slate-300 dark:hover:border-slate-600 group`}>
                  <span className={`font-black ${pose.color} group-hover:scale-105 transition-transform origin-left text-lg`}>{pose.label}</span>
                  <span className="text-slate-900 dark:text-slate-200 font-black text-xl">{pose.formattedTime}</span>
                </div>
              )) : <div className="py-20 text-center opacity-40 flex flex-col items-center gap-4 text-5xl">✨<p className="text-lg font-black text-slate-600 dark:text-slate-400">완벽한 자세를 유지했습니다!</p></div>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/50 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl mb-8 overflow-hidden h-[500px] backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 px-2 gap-4">
          <h3 className="text-xl font-black tracking-tight flex items-center gap-3"><span className="w-2 h-6 bg-emerald-400 rounded-full"></span>시간대별 집중 트렌드</h3>
          <div className="flex gap-6 text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-6 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
            <div className="flex items-center gap-2"><span className="w-4 h-1.5 bg-[#5B44F2] rounded-full shadow-sm"></span> 집중도 (%)</div>
            <div className="flex items-center gap-2"><span className="w-4 h-1.5 border-b-2 border-dashed border-slate-300 dark:border-slate-500"></span> 소음 (dB)</div>
          </div>
        </div>
        <div className="h-[350px] w-full">
          <Line
            data={{
              labels: reportData.chart.labels,
              datasets: [
                { label: '에너지', data: reportData.chart.scores, borderColor: '#5B44F2', backgroundColor: 'rgba(91,68,242,0.1)', borderWidth: 4, fill: true, tension: 0.4, pointRadius: 0 },
                { label: '소음', data: reportData.chart.noises, borderColor: '#cbd5e1', borderWidth: 2, borderDash: [5, 5], tension: 0.4, pointRadius: 0 }
              ]
            }}
            options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', padding: 12, cornerRadius: 8, titleFont: { size: 12 }, bodyFont: { weight: 'bold' } } },
              // 다크모드 시 차트 그리드 라인 색상 대응 불가피 (Tailwind 연동 한계로 ChartJS 내부 설정 고정)
              scales: { y: { beginAtZero: true, max: 110, grid: { color: 'rgba(148,163,184,0.1)' } }, x: { grid: { display: false } } }
            }}
          />
        </div>
      </div>
    </div>
  );
}
