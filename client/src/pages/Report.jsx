import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

import { immersionApi } from '../shared/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const NOISE_LABEL_MAP = {
  'ambient': '생활 소음', 'speech': '대화 소음', 'music': '음악 소음',
  'construction': '공사 소음', 'traffic': '교통 소음', 'none': '방해 없음'
};

const POSE_DETAIL_MAP = {
  'TILTED_WARNING': { label: '고개 기울임 위험', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
  'TILTED_CAUTION': { label: '고개 기울임 주의', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  'LEANING_ON_HAND': { label: '턱 괴기 감지', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
  'TURTLE_NECK': { label: '거북목 주의', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
  'TURNING_HEAD': { label: '시선 이탈', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
  'PHONE_USAGE': { label: '스마트폰 사용', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100' },
  'NORMAL': { label: '정상 자세', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  'GOOD_POSTURE': { label: '바른 자세 유지', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  'HAND_NEAR_FACE_CAUTION': { label: '얼굴 주변 손 감지', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  'SLUMPED_WARNING': { label: '구부정한 자세 위험', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
  'SLUMPED_CAUTION': { label: '자세 낮아짐 주의', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  'STATIC_WARNING': { label: '장시간 부동 자세', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
  'STATIC_CAUTION': { label: '부동 자세 주의', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  'TURTLE_NECK_WARNING': { label: '거북목 위험', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
  'TURTLE_NECK_CAUTION': { label: '거북목 주의', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' }
};

const formatSecondsToKoreanTime = (totalSeconds) => {
  if (!totalSeconds || totalSeconds === 0) return '0초';
  const h = Math.floor(totalSeconds / 3600); const m = Math.floor((totalSeconds % 3600) / 60); const s = totalSeconds % 60;
  let result = ''; if (h > 0) result += `${h}시간 `; if (m > 0) result += `${m}분 `; if (s > 0 || result === '') result += `${s}초`;
  return result.trim();
};

export default function Report() {
  const navigate = useNavigate();
  const { imm_idx } = useParams();
  const isDetailsMode = !!imm_idx && imm_idx !== 'undefined';

  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState(null); 
  const [fullHistory, setFullHistory] = useState([]); 

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const userInfo = JSON.parse(localStorage.getItem('user_info'));
        if (!userInfo) return navigate('/login');

        if (!isDetailsMode) {
          const res = await immersionApi.getHistory(userInfo.user_idx);
          if (res.success) setFullHistory(res.data || []);
          return;
        }

        const res = await immersionApi.getReportDetail(imm_idx);
        if (res.success && res.data) {
          const { session, noise_summary, pose_summary, chart_data } = res.data;
          const totalSecs = session.total_seconds || 0;

          const detailedPoses = pose_summary?.filter(p => p.count > 0).map(p => ({
            status: p.pose_status, label: POSE_DETAIL_MAP[p.pose_status]?.label || p.pose_status,
            count: p.count, formattedTime: formatSecondsToKoreanTime(p.count),
            color: POSE_DETAIL_MAP[p.pose_status]?.color || 'text-slate-600', bg: POSE_DETAIL_MAP[p.pose_status]?.bg || 'bg-slate-50 border-slate-100'
          })) || [];

          const totalWarningSeconds = detailedPoses.filter(p => !['NORMAL', 'GOOD_POSTURE'].includes(p.status)).reduce((sum, p) => sum + p.count, 0);
          
          let aiFeedback = { 오늘의총평: "분석 데이터를 구성하고 있습니다.", 긍정분석: "세션 기록 정상 완료", 보완사항: "다음 측정은 1분 이상 유지해 보세요.", 집중태그: "#집중" };
          if (session.ai_feedback) {
            try { 
              const parsed = JSON.parse(session.ai_feedback); 
              if (typeof parsed === 'object' && parsed !== null) aiFeedback = parsed;
              else throw new Error();
            } catch { aiFeedback.오늘의총평 = session.ai_feedback.includes("오류") ? "AI 분석 생성 실패" : session.ai_feedback; }
          }

          setReportData({
            summary: { date: session.imm_date, time: formatSecondsToKoreanTime(totalSecs), score: session.imm_score || 0, warningTime: formatSecondsToKoreanTime(totalWarningSeconds), mainNoise: NOISE_LABEL_MAP[noise_summary?.main_obstacle] || "방해 없음", aiFeedback },
            chart: { labels: chart_data?.map(d => d.time_label) || [], scores: chart_data?.map(d => d.imm_score) || [], noises: chart_data?.map(d => d.decibel) || [] },
            poseBreakdown: detailedPoses
          });
        }
      } catch (err) { console.error("Fetch Error:", err); } finally { setIsLoading(false); }
    };
    fetchAllData();
  }, [imm_idx, isDetailsMode, navigate]);

  if (isLoading) return <div className="min-h-[85vh] flex flex-col items-center justify-center gap-4"><div className="w-12 h-12 border-4 border-[#5B44F2] border-t-transparent rounded-full animate-spin"></div><p className="text-slate-500 font-black animate-pulse">분석 리포트를 불러오는 중...</p></div>;

  if (isDetailsMode && !reportData) return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center gap-6">
      <div className="text-6xl text-slate-200">🔍</div>
      <div className="text-center"><h3 className="text-2xl font-black text-slate-900 mb-2">리포트를 찾을 수 없습니다</h3><p className="text-slate-500 font-semibold text-sm">기록이 유실되었거나 분석 중인 세션입니다.</p></div>
      <button onClick={() => navigate('/report')} className="px-8 py-3 bg-[#5B44F2] text-white rounded-2xl font-black shadow-lg">보관함으로 돌아가기</button>
    </div>
  );

  if (!isDetailsMode) return (
    <div className="max-w-[1400px] mx-auto min-h-[90vh] p-10 font-sans animate-fade-in text-slate-900">
      <div className="flex justify-between items-end mb-10 pb-6 border-b border-slate-200/60">
        <div><h2 className="text-3xl font-black mb-1 tracking-tighter">분석 리포트 보관함</h2><p className="text-slate-500 font-medium">과거의 집중 기록을 한눈에 비교하세요.</p></div>
        <div className="px-5 py-2 bg-[#5B44F2]/10 border border-indigo-200 rounded-xl text-sm font-bold text-[#5B44F2]">총 {fullHistory.length}회의 기록</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {fullHistory.map((s, i) => (
          <div key={i} onClick={() => navigate(`/report/${s.imm_idx}`)} className="p-8 rounded-[2.5rem] border border-slate-200 bg-white transition-all hover:shadow-xl hover:-translate-y-2 cursor-pointer group shadow-sm flex flex-col h-full">
            <div className="flex justify-between items-center mb-8"><span className="font-extrabold text-slate-700 tracking-tighter">{new Date(s.imm_date).toLocaleDateString()}</span><span className="text-sm font-black text-[#5B44F2] bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">{s.imm_score}pt</span></div>
            <div className="text-sm text-slate-500 font-semibold space-y-4 mt-auto">
              <p className="flex justify-between border-b border-slate-50 pb-2"><span>시작 시각</span><span className="text-slate-900">{s.start_time?.substring(0, 5)}</span></p>
              <p className="flex justify-between border-b border-slate-50 pb-2"><span>집중 시간</span><span className="text-slate-900">{s.formatted_time || '0분'}</span></p>
              <p className="flex justify-between"><span>자세 이탈</span><span className="text-rose-500">{formatSecondsToKoreanTime(s.pose_count)}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto min-h-[90vh] p-10 font-sans animate-fade-in selection:bg-indigo-100 text-slate-900">
      <header className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-end mb-8 pb-6 border-b border-slate-200/60 gap-4 sm:gap-0">
        <div>
          <button onClick={() => navigate('/report')} className="text-xs font-black text-[#5B44F2] mb-3 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors w-fit">← 보관함으로 돌아가기</button>
          <h2 className="text-3xl font-black tracking-tighter">종합 분석 리포트</h2>
          {/* '몰입 패턴' -> '집중 패턴' */}
          <p className="text-slate-500 font-medium">사용자님의 집중 패턴을 AI가 정밀 분석했습니다.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { l: '총 집중 시간', v: reportData.summary.time, i: '⏱️', c: 'text-[#5B44F2]', b: 'bg-indigo-50' }, 
          { l: '집중 에너지', v: reportData.summary.score + 'pt', i: '⚡', c: 'text-emerald-500', b: 'bg-emerald-50' }, 
          { l: '자세 이탈 시간', v: reportData.summary.warningTime, i: '🚨', c: 'text-rose-500', b: 'bg-rose-50' }, 
          { l: '주요 방해 소음', v: reportData.summary.mainNoise, i: '🎧', c: 'text-amber-500', b: 'bg-amber-50' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6 transition-all hover:shadow-xl hover:-translate-y-1">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-inner ${item.b} ${item.c}`}>{item.i}</div>
            <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-widest">{item.l}</p><p className="text-2xl font-black tracking-tight truncate">{item.v}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        <div className="lg:col-span-6 h-full">
          <div className="h-full p-10 rounded-[2.5rem] shadow-xl bg-gradient-to-br from-[#5B44F2] via-[#7c3aed] to-[#d946ef] text-white relative overflow-hidden transition-all hover:shadow-2xl group">
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
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm h-full transition-all hover:shadow-xl text-slate-900">
            <h3 className="text-lg font-black mb-8 flex items-center gap-3 tracking-tight"><span className="w-2 h-6 bg-[#5B44F2] rounded-full"></span>자세 정밀 분석 <span className="text-xs text-slate-400 font-normal ml-2 tracking-widest">(누적 유지 시간)</span></h3>
            <div className="space-y-4">
              {reportData.poseBreakdown.length > 0 ? reportData.poseBreakdown.map((p, i) => (
                <div key={i} className={`flex justify-between items-center p-5 rounded-2xl ${p.bg} border transition-all hover:border-slate-300 group`}>
                  <span className={`font-black ${p.color} group-hover:scale-105 transition-transform origin-left text-lg`}>{p.label}</span>
                  <span className="text-slate-900 font-black text-xl">{p.formattedTime}</span>
                </div>
              )) : <div className="py-20 text-center opacity-40 flex flex-col items-center gap-4 text-5xl">✨<p className="text-lg font-black text-slate-600">완벽한 자세를 유지했습니다!</p></div>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:shadow-xl mb-8 overflow-hidden h-[500px]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 px-2 gap-4">
          <h3 className="text-xl font-black tracking-tight flex items-center gap-3"><span className="w-2 h-6 bg-emerald-400 rounded-full"></span>시간대별 집중 트렌드</h3>
          <div className="flex gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 shadow-inner">
            <div className="flex items-center gap-2"><span className="w-4 h-1.5 bg-[#5B44F2] rounded-full shadow-sm"></span> 집중도 (%)</div>
            <div className="flex items-center gap-2"><span className="w-4 h-1.5 border-b-2 border-dashed border-slate-300"></span> 소음 (dB)</div>
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
              scales: { y: { beginAtZero: true, max: 110, grid: { color: 'rgba(0,0,0,0.02)' } }, x: { grid: { display: false } } } 
            }} 
          />
        </div>
      </div>
    </div>
  );
}