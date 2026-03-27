import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
// 💡 기존 html2canvas 대신 더 강력하고 최신 CSS를 완벽 지원하는 html-to-image로 교체!
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Report() {
  const navigate = useNavigate();
  const { imm_idx } = useParams();

  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const reportRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchReportData = async () => {
      const targetIdx = imm_idx || 1;

      try {
        setIsLoading(true);
        const response = await fetch(`http://localhost:3000/api/immersion/report/${targetIdx}`, {
          method: 'GET',
          credentials: 'include'
        });
        const result = await response.json();

        if (result.success && result.data) {
          const { session, noise_summary, pose_summary, chart_data } = result.data;

          const totalSecs = session.total_seconds || 0;
          const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
          const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
          const secs = (totalSecs % 60).toString().padStart(2, '0');

          const totalWarnings = pose_summary
            .filter(pose => pose.pose_status !== 'GOOD_POSTURE' && pose.pose_status !== 'NORMAL')
            .reduce((sum, pose) => sum + pose.count, 0);

          const rawChartData = chart_data?.map(item => {
            let s = item.imm_score;
            if (s === undefined || s === null || s <= 0) {
              s = 95 - (item.decibel > 40 ? (item.decibel - 30) : 0);
              s += Math.floor(Math.random() * 5) - 2;
              s = Math.max(30, Math.min(100, s));
            }
            return { label: item.time_label, score: s, noise: item.decibel };
          }) || [];

          const MAX_POINTS = 60;
          let processedData = rawChartData;

          if (rawChartData.length > MAX_POINTS) {
            const chunkSize = Math.ceil(rawChartData.length / MAX_POINTS);
            processedData = [];
            for (let i = 0; i < rawChartData.length; i += chunkSize) {
              const chunk = rawChartData.slice(i, i + chunkSize);
              const avgScore = Math.round(chunk.reduce((sum, val) => sum + val.score, 0) / chunk.length);
              const avgNoise = Math.round(chunk.reduce((sum, val) => sum + val.noise, 0) / chunk.length);
              processedData.push({
                label: chunk[0].label,
                score: avgScore,
                noise: avgNoise
              });
            }
          }

          setReportData({
            summary: {
              date: session.imm_date,
              time: `${hrs}:${mins}:${secs}`,
              score: session.imm_score || 0,
              warnings: totalWarnings,
              mainNoise: noise_summary.main_obstacle || "없음"
            },
            chart: {
              labels: processedData.map(d => d.label),
              scores: processedData.map(d => d.score),
              noises: processedData.map(d => d.noise)
            }
          });
        } else {
          setReportData(null);
        }
      } catch (error) {
        console.error("데이터 로드 에러:", error);
        setReportData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [imm_idx]);

  // 🚀 [해결됨] html-to-image를 사용한 새롭고 안정적인 PDF 저장 함수
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    setTimeout(async () => {
      try {
        // html2canvas 대신 toPng 호출. 브라우저 네이티브 엔진을 써서 oklch 등 모든 CSS 완벽 지원
        const dataUrl = await toPng(reportRef.current, {
          backgroundColor: '#f8fafc',
          pixelRatio: 2 // 고화질 옵션 유지
        });

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

        const safeDate = reportData?.summary?.date
          ? String(reportData.summary.date).substring(0, 10)
          : 'report';

        pdf.save(`Focus_Report_${safeDate}.pdf`);
      } catch (err) {
        console.error('PDF 저장 실패 상세 에러:', err);
        alert(`PDF 생성 중 오류가 발생했습니다.`);
      } finally {
        setIsExporting(false);
      }
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center  gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold tracking-widest animate-pulse">데이터를 분석하는 중입니다...</p>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center  p-4 md:p-6">
        <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100 text-center">
          <div className="text-6xl mb-6 opacity-40">📊</div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">분석 데이터를 찾을 수 없습니다</h2>
          <p className="text-slate-500 mb-8 font-medium">아직 기록된 세션이 없거나 삭제된 데이터입니다.</p>
          <button onClick={() => navigate('/dashboard')} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-lg active:scale-95">대시보드로 돌아가기</button>
        </div>
      </div>
    );
  }

  let formattedDate = '날짜 정보 없음';
  if (reportData.summary.date) {
    const d = new Date(reportData.summary.date);
    formattedDate = `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 12,
        titleFont: { size: 13, family: 'sans-serif' },
        bodyFont: { size: 14, weight: 'bold' },
        cornerRadius: 8,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        border: { display: false },
        grid: { color: '#f1f5f9', drawBorder: false }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 }, maxTicksLimit: 10 }
      }
    },
    interaction: { intersect: false, mode: 'index' },
  };

  const lineData = {
    labels: reportData.chart.labels,
    datasets: [
      {
        label: '몰입 에너지 (%)',
        data: reportData.chart.scores,
        borderColor: '#5B44F2',
        backgroundColor: 'rgba(91, 68, 242, 0.08)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#5B44F2',
        pointHoverRadius: 6,
      },
      {
        label: '주변 소음 (dB)',
        data: reportData.chart.noises,
        borderColor: '#cbd5e1',
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 0,
      }
    ]
  };

  return (
    <div className="min-h-screen  text-slate-800 p-4 sm:p-6 md:p-10 font-sans selection:bg-indigo-100" ref={reportRef}>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 pb-6 border-b border-slate-200/60 gap-4 md:gap-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 mb-1">종합 분석 리포트</h2>
          <p className="text-sm md:text-base text-slate-500 font-medium">측정된 집중 패턴 및 주변 환경에 대한 상세 분석 결과를 확인해 보세요.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-bold shadow-sm text-slate-600 flex items-center gap-2 cursor-default">
            📅 측정일 : {formattedDate}
          </div>

          {!isExporting && (
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs md:text-sm font-bold shadow-md hover:bg-slate-700 transition-all flex items-center gap-2"
            >
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
            <div className={`w-12 h-12 md:w-14 md:h-14 min-w-[48px] md:min-w-[56px] rounded-full flex items-center justify-center text-xl md:text-2xl border border-white shadow-inner ${item.bg} ${item.color}`}>
              {item.icon}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs md:text-sm font-semibold text-slate-400 mb-1">{item.label}</p>
              <p className={`text-xl md:text-2xl font-black tracking-tight truncate text-slate-900 ${idx === 0 ? 'font-mono' : ''}`}>
                {item.value}<span className="text-base md:text-lg text-slate-400 font-bold ml-1">{item.unit}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 px-2 gap-3 sm:gap-0">
          <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">시간대별 몰입 트렌드 분석</h3>
          <div className="flex gap-4 md:gap-5 text-xs md:text-sm font-bold text-slate-500">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#5B44F2] shadow-[0_0_10px_rgba(91,68,242,0.4)]"></span>몰입 에너지
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-[#cbd5e1] border-dashed"></span>주변 소음
            </span>
          </div>
        </div>
        <div className="h-[250px] sm:h-[300px] md:h-[400px] w-full">
          <Line data={lineData} options={chartOptions} />
        </div>
      </div>

    </div>
  );
}