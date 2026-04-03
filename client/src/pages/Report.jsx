import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

/* FSD 아키텍처 규격에 따른 공통 API 모듈 참조 */
import { immersionApi } from '../shared/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/* --- 공통 데이터 매핑 상수 정의 --- */

const NOISE_LABEL_MAP = {
  'ambient': '주변 소음',
  'speech': '대화 소음',
  'music': '음악 소음',
  'construction': '공사 소음',
  'traffic': '교통 소음',
  'none': '없음'
};

const POSE_DETAIL_MAP = {
  'TILTED_WARNING': { label: '고개 기울임 위험', color: 'text-rose-600', bg: 'bg-rose-50' },
  'TILTED_CAUTION': { label: '고개 기울임 주의', color: 'text-amber-600', bg: 'bg-amber-50' },
  'LEANING_ON_HAND': { label: '턱 괴기 감지', color: 'text-orange-600', bg: 'bg-orange-50' },
  'TURTLE_NECK': { label: '거북목(구부정함)', color: 'text-rose-600', bg: 'bg-rose-50' },
  'TURNING_HEAD': { label: '시선 이탈', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  'PHONE_USAGE': { label: '스마트폰 사용', color: 'text-slate-600', bg: 'bg-slate-50' },
  'NORMAL': { label: '정상 자세', color: 'text-emerald-600', bg: 'bg-emerald-50' }
};

/* --- 공통 SVG 아이콘 컴포넌트 정의 --- */

const ChartAreaIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
);

const AiBrainApiIcon = () => (
  <svg width="40" height="40" viewBox="0 0 64 64" fill="none" className="text-indigo-100">
    <path d="M32 54C44.1503 54 54 44.1503 54 32C54 19.8497 44.1503 10 32 10C19.8497 10 10 19.8497 10 32C10 44.1503 19.8497 54 32 54Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M32 44V20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 34L32 24L42 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/**
 * 집중 분석 리포트 페이지 컴포넌트
 */
export default function Report() {
  const navigate = useNavigate();
  const { imm_idx } = useParams();

  const isDetailsMode = imm_idx && imm_idx !== 'undefined';
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState(null); 
  const [fullHistory, setFullHistory] = useState([]); 
  const [bottomHistory, setBottomHistory] = useState([]); 

  const reportRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const userInfoStr = localStorage.getItem('user_info');
        if (!userInfoStr) { navigate('/login'); return; }
        const user_idx = JSON.parse(userInfoStr).user_idx;

        if (!isDetailsMode) {
          const historyResult = await immersionApi.getHistory(user_idx);
          if (historyResult && historyResult.success) setFullHistory(historyResult.data || []);
          setIsLoading(false);
          return;
        }

        const [reportResult, historyResult] = await Promise.all([
          immersionApi.getReportDetail(imm_idx),
          immersionApi.getHistory(user_idx)
        ]);

        if (reportResult && reportResult.success && reportResult.data) {
          const { session, noise_summary, pose_summary, chart_data } = reportResult.data;

          if (!session) { setIsLoading(false); return; }

          const totalSecs = session.total_seconds || 0;
          const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
          const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
          const secs = (totalSecs % 60).toString().padStart(2, '0');

          const detailedPoses = pose_summary
            ?.filter(p => p.pose_status !== 'GOOD_POSTURE' && p.pose_status !== 'NORMAL' && p.count > 0)
            .map(p => ({
              status: p.pose_status,
              label: POSE_DETAIL_MAP[p.pose_status]?.label || p.pose_status,
              count: p.count,
              color: POSE_DETAIL_MAP[p.pose_status]?.color || 'text-slate-600',
              bg: POSE_DETAIL_MAP[p.pose_status]?.bg || 'bg-slate-50'
            })) || [];

          const totalWarnings = detailedPoses.reduce((sum, p) => sum + p.count, 0);

          let rawChartData = chart_data?.map(item => ({
            label: item.time_label, score: item.imm_score || 0, noise: item.decibel || 0
          })) || [];

          const MAX_POINTS = 60;
          let processedData = rawChartData;
          if (rawChartData.length > MAX_POINTS) {
            const chunkSize = Math.ceil(rawChartData.length / MAX_POINTS);
            processedData = [];
            for (let i = 0; i < rawChartData.length; i += chunkSize) {
              const chunk = rawChartData.slice(i, i + chunkSize);
              const avgS = Math.round(chunk.reduce((a, b) => a + b.score, 0) / chunk.length);
              const avgN = Math.round(chunk.reduce((a, b) => a + b.noise, 0) / chunk.length);
              processedData.push({ label: chunk[0].label, score: avgS, noise: avgN });
            }
          }

          setReportData({
            summary: {
              date: session.imm_date,
              time: `${hrs}:${mins}:${secs}`,
              score: session.imm_score || 0,
              warnings: totalWarnings,
              poseBreakdown: detailedPoses,
              mainNoise: NOISE_LABEL_MAP[noise_summary?.main_obstacle] || "주변 소음",
              aiFeedback: session.ai_feedback || "분석된 피드백 데이터가 존재하지 않습니다."
            },
            chart: {
              labels: processedData.map(d => d.label),
              scores: processedData.map(d => d.score),
              noises: processedData.map(d => d.noise)
            }
          });
        }

        if (historyResult && historyResult.success) {
          setBottomHistory(historyResult.data.filter(item => String(item.imm_idx) !== String(imm_idx)).slice(0, 4));
        }
      } catch (err) { console.error("리포트 조회 에러", err); } finally { setIsLoading(false); }
    };
    fetchAllData();
  }, [imm_idx, navigate, isDetailsMode]);

  const handleExportPDF = async () => {
    if (!reportRef.current || !reportData) return;

    setIsExporting(true);

    setTimeout(async () => {
      try {
        const dataUrl = await toPng(reportRef.current, { 
          backgroundColor: '#f8fafc', 
          pixelRatio: 2,
          filter: (node) => {
            if (node.classList?.contains('pdf-exclude')) return false;
            return true;
          }
        });

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

        const userInfoStr = localStorage.getItem('user_info');
        const userName = userInfoStr ? JSON.parse(userInfoStr).user_name : '유저';
        
        const d = new Date(reportData.summary.date);
        const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
        const timeStr = reportData.summary.time.replace(/:/g, '').substring(0, 4);
        
        const fileName = `[집중리포트]_${userName}_${dateStr}_${timeStr}.pdf`;

        pdf.save(fileName);
      } catch (err) {
        console.error('PDF 저장 오류:', err.message);
      } finally {
        setIsExporting(false);
      }
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#5B44F2] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold tracking-widest animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  /* 목록 모드 UI 렌더링 */
  if (!isDetailsMode) {
    return (
      <div className="max-w-[1400px] mx-auto min-h-[90vh] text-slate-800 p-4 sm:p-6 md:p-10 font-sans animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 pb-6 border-b border-slate-200/60 gap-4 md:gap-0">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 mb-1">분석 리포트 보관함</h2>
            <p className="text-sm md:text-base text-slate-500 font-medium">과거에 측정했던 집중 세션 기록들을 확인하고 비교해보세요.</p>
          </div>
          <div className="px-4 py-2.5 bg-[#5B44F2]/10 border border-[#5B44F2]/20 rounded-xl text-xs md:text-sm font-bold text-[#5B44F2]">
            📊 총 {fullHistory.length}개의 집중 데이터
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {fullHistory.map((session, idx) => (
            <div key={idx} onClick={() => navigate(`/report/${session.imm_idx}`)} className="p-6 rounded-3xl border border-slate-100 bg-white hover:border-[#5B44F2]/30 hover:shadow-lg transition-all cursor-pointer group shadow-sm">
              <div className="flex justify-between items-center mb-5">
                <span className="font-extrabold text-slate-700 text-lg">{new Date(session.imm_date).toLocaleDateString()}</span>
                <span className="text-sm font-black text-[#5B44F2] bg-[#5B44F2]/10 px-3 py-1.5 rounded-xl border border-[#5B44F2]/20">{session.imm_score}점</span>
              </div>
              <div className="text-sm text-slate-500 font-medium space-y-2 mt-auto">
                <p className="flex justify-between border-b border-slate-100 pb-2"><span>시작 시간</span> <span className="text-slate-900 font-semibold">{session.start_time?.substring(0, 5)}</span></p>
                <p className="flex justify-between border-b border-slate-100 pb-2"><span>총 집중</span> <span className="text-slate-900 font-semibold">{session.formatted_time || '0분'}</span></p>
                <p className="flex justify-between"><span>자세 이탈</span> <span className="text-rose-500 font-semibold">{session.pose_count}회</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!reportData) return null;

  /* 차트 옵션 설정 */
  const chartOptions = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { 
      legend: { display: false }, 
      tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}${ctx.datasetIndex === 0 ? '%' : 'dB'}` } } 
    },
    layout: { padding: { left: 10, right: 10, top: 30, bottom: 10 } },
    scales: {
      y: { type: 'linear', position: 'left', beginAtZero: true, max: 110, grid: { color: 'rgba(241, 245, 249, 0.5)', drawBorder: false }, ticks: { callback: (v) => v <= 100 ? v + '%' : '', color: '#5B44F2', font: { weight: 'bold' } } },
      y1: { type: 'linear', position: 'right', beginAtZero: true, suggestedMax: 120, grid: { drawOnChartArea: false }, ticks: { callback: (v) => v + 'dB', color: '#94a3b8' } },
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 }, maxTicksLimit: 10 } }
    },
    interaction: { intersect: false, mode: 'index' },
  };

  const lineData = {
    labels: reportData.chart.labels,
    datasets: [
      { label: '집중 에너지', data: reportData.chart.scores, borderColor: '#5B44F2', backgroundColor: 'rgba(91, 68, 242, 0.06)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, yAxisID: 'y' },
      { label: '주변 소음', data: reportData.chart.noises, borderColor: 'rgba(148, 163, 184, 0.6)', borderWidth: 1.5, borderDash: [4, 4], tension: 0.4, pointRadius: 0, yAxisID: 'y1' }
    ]
  };

  return (
    <div className="max-w-[1400px] mx-auto min-h-[90vh] text-slate-800 p-4 sm:p-6 md:p-10 font-sans animate-fade-in" ref={reportRef}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 pb-6 border-b border-slate-200/60 gap-4 md:gap-0">
        <div>
          <button onClick={() => navigate('/report')} className="text-sm font-bold text-[#5B44F2] mb-2.5 flex items-center gap-1.5 group pdf-exclude">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transform transition-transform group-hover:-translate-x-1"><path d="m15 18-6-6 6-6"/></svg> 보관함으로 돌아가기
          </button>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 mb-1">종합 분석 리포트</h2>
          <p className="text-sm md:text-base text-slate-500 font-medium">측정된 집중 패턴 및 주변 환경에 대한 분석 결과입니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto pdf-exclude">
          {!isExporting && <button onClick={handleExportPDF} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs md:text-sm font-bold shadow-md hover:bg-slate-700 transition-all">📥 PDF 저장</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {[
          { label: '총 집중 시간', value: reportData.summary.time, unit: '', icon: '⏱️', color: 'text-[#5B44F2]', bg: 'bg-[#5B44F2]/10' },
          { label: '평균 집중도', value: reportData.summary.score, unit: '점', icon: '⚡', color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: '자세 경고 횟수', value: reportData.summary.warnings, unit: '회', icon: '🚨', color: 'text-rose-500', bg: 'bg-rose-50' },
          { label: '주요 방해 소음', value: reportData.summary.mainNoise, unit: '', icon: '🎧', color: 'text-amber-500', bg: 'bg-amber-50' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-5 md:p-7 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 md:gap-5 transition-all hover:shadow-md hover:-translate-y-1">
            <div className={`w-12 h-12 md:w-14 md:h-14 min-w-[48px] rounded-full flex items-center justify-center text-xl md:text-2xl ${item.bg} ${item.color}`}>{item.icon}</div>
            <div className="overflow-hidden">
              <p className="text-xs md:text-sm font-semibold text-slate-400 mb-1">{item.label}</p>
              <p className="text-xl md:text-2xl font-black text-slate-900">{item.value}<span className="text-base text-slate-400 font-bold ml-1">{item.unit}</span></p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        <div className="lg:col-span-8">
          <div className="h-full bg-[#5B44F2] text-white p-6 md:p-8 rounded-3xl shadow-xl shadow-[#5B44F2]/20 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-white/10 rounded-3xl flex items-center justify-center border border-white/20"><AiBrainApiIcon /></div>
              <div className="text-center md:text-left flex-1">
                <h3 className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-2">AI 집중 분석 피드백</h3>
                <p className="text-lg md:text-xl font-bold leading-relaxed break-keep">"{reportData.summary.aiFeedback}"</p>
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm h-full hover:shadow-md transition-all">
            <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2"><span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>자세 정밀 분석</h3>
            <div className="space-y-3">
              {reportData.summary.poseBreakdown.length > 0 ? reportData.summary.poseBreakdown.map((pose, i) => (
                <div key={i} className={`flex justify-between items-center p-4 rounded-2xl ${pose.bg} border border-slate-50`}>
                  <span className={`font-bold ${pose.color}`}>{pose.label}</span>
                  <span className="text-slate-900 font-black">{pose.count}<span className="text-xs text-slate-400 font-bold ml-0.5">회</span></span>
                </div>
              )) : <div className="py-10 text-center opacity-40"><p className="text-sm font-bold">감지된 자세 결함이 없습니다.</p></div>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-100 shadow-sm mb-8 hover:shadow-md transition-all">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-10 px-2 gap-3 sm:gap-0">
          <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">시간대별 집중 트렌드 및 소음도 분석</h3>
          <div className="flex gap-4 text-xs font-semibold text-slate-500 pdf-exclude">
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#5B44F2]"></span> 집중 에너지(좌)</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-b border-dashed border-slate-400"></span> 주변 소음(우)</div>
          </div>
        </div>
        <div className="h-[250px] sm:h-[300px] md:h-[480px] w-full"><Line data={lineData} options={chartOptions} /></div>
      </div>
    </div>
  );
}