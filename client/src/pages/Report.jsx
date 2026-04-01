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

/* --- 공통 SVG 아이콘 컴포넌트 정의 --- */
const ListIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const ChartAreaIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
);

/**
 * 몰입 분석 리포트 페이지 컴포넌트
 * 백엔드 shared 응답 표준을 준수하며 차트 및 세션 요약 데이터를 시각화함
 */
export default function Report() {
  const navigate = useNavigate();
  const { imm_idx } = useParams();

  /* URL 파라미터 존재 여부에 따라 '상세 보기'와 '전체 목록' 모드를 전환함 */
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
        if (!userInfoStr) {
          alert("로그인이 필요한 서비스입니다.");
          navigate('/login');
          return;
        }
        const user_idx = JSON.parse(userInfoStr).user_idx;

        /* 목록 모드: 사용자의 전체 몰입 히스토리 조회 */
        if (!isDetailsMode) {
          const historyResult = await immersionApi.getHistory(user_idx);
          if (historyResult && historyResult.success) {
            setFullHistory(historyResult.data || []); 
          }
          setIsLoading(false);
          return; 
        }

        /* 상세 모드: 특정 세션 리포트 및 하단 추천 리스트 병렬 조회 */
        const [reportResult, historyResult] = await Promise.all([
          immersionApi.getReportDetail(imm_idx),
          immersionApi.getHistory(user_idx)
        ]);

        /* 백엔드 shared 규격(result.success, result.data) 반영 */
        if (reportResult && reportResult.success && reportResult.data) {
          const rawData = reportResult.data; 
          const { session, noise_summary, pose_summary, chart_data } = rawData;

          if (!session) {
            setIsLoading(false);
            return;
          }

          /* 시간 단위 변환 및 데이터 가공 */
          const totalSecs = session.total_seconds || 0;
          const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
          const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
          const secs = (totalSecs % 60).toString().padStart(2, '0');

          const totalWarnings = pose_summary
            ?.filter(pose => pose.pose_status !== 'GOOD_POSTURE' && pose.pose_status !== 'NORMAL')
            .reduce((sum, pose) => sum + pose.count, 0) || 0;

          /* 차트 렌더링 최적화를 위한 데이터 샘플링 (최대 60포인트) */
          let rawChartData = chart_data?.map(item => ({
            label: item.time_label, 
            score: item.imm_score || 0,
            noise: item.decibel || 0
          })) || [];

          const MAX_POINTS = 60;
          let processedData = rawChartData;

          if (rawChartData.length > MAX_POINTS) {
            const chunkSize = Math.ceil(rawChartData.length / MAX_POINTS);
            processedData = [];
            for (let i = 0; i < rawChartData.length; i += chunkSize) {
              const chunk = rawChartData.slice(i, i + chunkSize);
              const avgScore = Math.round(chunk.reduce((sum, val) => sum + val.score, 0) / chunk.length);
              const avgNoise = Math.round(chunk.reduce((sum, val) => sum + val.noise, 0) / chunk.length);
              processedData.push({ label: chunk[0].label, score: avgScore, noise: avgNoise });
            }
          }

          setReportData({
            summary: {
              date: session.imm_date,
              time: `${hrs}:${mins}:${secs}`,
              score: session.imm_score || 0,
              warnings: totalWarnings,
              mainNoise: noise_summary?.main_obstacle || "없음"
            },
            chart: {
              labels: processedData.map(d => d.label),
              scores: processedData.map(d => d.score),
              noises: processedData.map(d => d.noise)
            }
          });
        }

        if (historyResult && historyResult.success && historyResult.data) {
          const filteredBottomHistory = historyResult.data
            .filter(item => String(item.imm_idx) !== String(imm_idx))
            .slice(0, 4);
          setBottomHistory(filteredBottomHistory);
        }

      } catch (error) {
        console.error("API 데이터 조회 실패:", error.message);
        alert("서버 통신 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [imm_idx, navigate, isDetailsMode]);

  /**
   * 리포트 화면을 캡처하여 PDF 파일로 내보내기합니다.
   */
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    setTimeout(async () => {
      try {
        const dataUrl = await toPng(reportRef.current, { backgroundColor: '#f8fafc', pixelRatio: 2 });
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

        const safeDate = reportData?.summary?.date ? String(reportData.summary.date).substring(0, 10) : 'report';
        pdf.save(`Focus_Report_${safeDate}.pdf`);
      } catch (err) {
        console.error('PDF 생성 오류:', err.message);
      } finally {
        setIsExporting(false);
      }
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold tracking-widest animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (isDetailsMode && !reportData) {
    return (
      <div className="max-w-[1400px] mx-auto min-h-[85vh] flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center flex flex-col items-center gap-4">
          <div className="text-7xl mb-4 opacity-50">📭</div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">데이터를 찾을 수 없습니다</h2>
          <p className="text-slate-500 text-lg mb-8 font-medium">삭제되었거나 유효하지 않은 세션 기록입니다.</p>
          <button onClick={() => navigate('/report')} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-200 active:scale-95 text-lg">
            전체 보관함 보기
          </button>
        </div>
      </div>
    );
  }

  /* 렌더링 Case 1: 리포트 보관함 (목록 모드) */
  if (!isDetailsMode) {
    return (
      <div className="max-w-[1400px] mx-auto min-h-[90vh] text-slate-800 p-4 sm:p-6 md:p-10 font-sans selection:bg-indigo-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 pb-6 border-b border-slate-200/60 gap-4 md:gap-0">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 mb-1">분석 리포트 보관함</h2>
            <p className="text-sm md:text-base text-slate-500 font-medium">과거에 측정했던 몰입 세션 기록들을 확인하고 비교해보세요.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs md:text-sm font-bold shadow-sm text-indigo-700 flex items-center gap-2 cursor-default">
              📊 총 {fullHistory.length}개의 몰입 데이터
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {fullHistory.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
              <div className="text-8xl mb-8">🌱</div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">기록된 리포트가 없습니다</h2>
              <p className="text-slate-500 text-lg mb-10 font-medium">대시보드에서 첫 집중 측정을 시작해 보세요!</p>
              <button onClick={() => navigate('/dashboard')} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-200 active:scale-95 text-lg">
                ▶ 집중 측정 시작
              </button>
            </div>
          ) : (
            fullHistory.map((session, idx) => {
              const sessionDate = new Date(session.imm_date);
              const historyDateStr = `${sessionDate.getFullYear()}년 ${sessionDate.getMonth() + 1}월 ${sessionDate.getDate()}일`;

              return (
                <div key={idx} onClick={() => navigate(`/report/${session.imm_idx}`)} className="p-6 rounded-3xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-full shadow-sm">
                  <div className="flex justify-between items-center mb-5">
                    <span className="font-extrabold text-slate-700 text-lg">{historyDateStr}</span>
                    <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">{session.imm_score}점</span>
                  </div>
                  <div className="text-sm text-slate-500 font-medium space-y-2 mt-auto">
                    <p className="flex justify-between border-b border-slate-100 pb-2"><span>시작 시간</span> <span className="text-slate-900 font-semibold">{session.start_time?.substring(0, 5)}</span></p>
                    <p className="flex justify-between border-b border-slate-100 pb-2"><span>총 집중</span> <span className="text-slate-900 font-semibold">{session.formatted_time || '0분'}</span></p>
                    <p className="flex justify-between"><span>자세 이탈</span> <span className="text-rose-500 font-semibold">{session.pose_count}회</span></p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  /* 렌더링 Case 2: 리포트 상세 보기 (차트 및 요약) */
  const chartOptions = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, titleFont: { size: 13, family: 'sans-serif' }, bodyFont: { size: 14, weight: 'bold' }, cornerRadius: 8 }
    },
    scales: {
      y: { beginAtZero: true, max: 100, border: { display: false }, grid: { color: '#f1f5f9', drawBorder: false } },
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 }, maxTicksLimit: 10 } }
    },
    interaction: { intersect: false, mode: 'index' },
  };

  const lineData = {
    labels: reportData.chart.labels,
    datasets: [
      {
        label: '몰입 에너지 (%)',
        data: reportData.chart.scores,
        borderColor: '#5B44F2', backgroundColor: 'rgba(91, 68, 242, 0.08)', borderWidth: 3, fill: true, tension: 0.4, pointRadius: 2, pointBackgroundColor: '#fff', pointBorderColor: '#5B44F2', pointHoverRadius: 6,
      },
      {
        label: '주변 소음 (dB)',
        data: reportData.chart.noises,
        borderColor: '#cbd5e1', borderWidth: 2, borderDash: [5, 5], tension: 0.4, pointRadius: 0,
      }
    ]
  };

  let formattedDetailDate = '날짜 정보 없음';
  if (reportData.summary.date) {
    const d = new Date(reportData.summary.date);
    formattedDetailDate = `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
  }

  return (
    <div className="max-w-[1400px] mx-auto min-h-[90vh] text-slate-800 p-4 sm:p-6 md:p-10 font-sans selection:bg-indigo-100" ref={reportRef}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 pb-6 border-b border-slate-200/60 gap-4 md:gap-0">
        <div>
          <button onClick={() => navigate('/report')} className="text-sm font-bold text-indigo-600 mb-2.5 flex items-center gap-1.5 group">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transform transition-transform group-hover:-translate-x-1"><path d="m15 18-6-6 6-6"/></svg> 보관함으로 돌아가기
          </button>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 mb-1">종합 분석 리포트</h2>
          <p className="text-sm md:text-base text-slate-500 font-medium">측정된 집중 패턴 및 주변 환경에 대한 분석 결과입니다.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-bold shadow-sm text-slate-600 flex items-center gap-2 cursor-default">
            📅 측정일 : {formattedDetailDate}
          </div>
          {!isExporting && (
            <button onClick={handleExportPDF} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs md:text-sm font-bold shadow-md hover:bg-slate-700 transition-all flex items-center gap-2">
              📥 PDF 저장
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {[
          { label: '총 집중 시간', value: reportData.summary.time, unit: '', icon: '⏱️', color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: '평균 몰입도', value: reportData.summary.score, unit: '점', icon: '⚡', color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: '자세 경고 횟수', value: reportData.summary.warnings, unit: '회', icon: '🚨', color: 'text-rose-500', bg: 'bg-rose-50' },
          { label: '주요 방해 소음', value: reportData.summary.mainNoise, unit: '', icon: '🎧', color: 'text-amber-500', bg: 'bg-amber-50' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-5 md:p-7 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 md:gap-5 hover:shadow-md transition-all cursor-default">
            <div className={`w-12 h-12 md:w-14 md:h-14 min-w-[48px] rounded-full flex items-center justify-center text-xl md:text-2xl border border-white shadow-inner ${item.bg} ${item.color}`}>{item.icon}</div>
            <div className="overflow-hidden">
              <p className="text-xs md:text-sm font-semibold text-slate-400 mb-1">{item.label}</p>
              <p className={`text-xl md:text-2xl font-black tracking-tight truncate text-slate-900 ${idx === 0 ? 'font-mono' : ''}`}>{item.value}<span className="text-base text-slate-400 font-bold ml-1">{item.unit}</span></p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 px-2 gap-3 sm:gap-0">
          <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">시간대별 몰입 트렌드 분석</h3>
        </div>
        <div className="h-[250px] sm:h-[300px] md:h-[400px] w-full"><Line data={lineData} options={chartOptions} /></div>
      </div>

      <div className="mt-8 bg-white p-5 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100"><ChartAreaIcon /></div>
          <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">다른 날짜의 몰입 기록</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {bottomHistory.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-400 font-medium">비교할 수 있는 다른 세션 기록이 없습니다.</div>
          ) : (
            bottomHistory.map((session, idx) => {
              const sessionDate = new Date(session.imm_date);
              const historyDateStr = `${sessionDate.getMonth() + 1}월 ${sessionDate.getDate()}일`;

              return (
                <div key={idx} onClick={() => navigate(`/report/${session.imm_idx}`)} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-slate-700">{historyDateStr}</span>
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">{session.imm_score}점</span>
                  </div>
                  <div className="text-sm text-slate-500 font-medium space-y-1.5">
                    <p className="flex justify-between"><span>시작 시간</span> <span className="text-slate-700">{session.start_time?.substring(0, 5)}</span></p>
                    <p className="flex justify-between"><span>자세 이탈</span> <span className="text-rose-500 font-bold">{session.pose_count}회</span></p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}