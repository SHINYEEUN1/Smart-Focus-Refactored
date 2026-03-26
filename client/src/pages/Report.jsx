import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Report() {
  const navigate = useNavigate();
  // 💡 명세서 4번에 따라 /report/:imm_idx 주소에서 번호를 가져옵니다.
  const { imm_idx } = useParams();

  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReportData = async () => {
      // URL에 번호가 없으면 기본값 1번 세션을 불러옵니다.
      const targetIdx = imm_idx || 1;

      try {
        setIsLoading(true);

        // 🚀 [API 연동] 명세서 4번: GET /api/immersion/report/:imm_idx 호출
        const response = await fetch(`http://localhost:3000/api/immersion/report/${targetIdx}`, {
          method: 'GET',
          credentials: 'include'
        });
        const result = await response.json();

        if (result.success && result.data) {
          const { session, noise_summary, pose_summary } = result.data;

          // 🛠️ 1. 전체 집중 시간 (명세서의 data.session.total_seconds 활용)
          const totalSecs = session.total_seconds || 0;
          const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
          const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
          const secs = (totalSecs % 60).toString().padStart(2, '0');

          // 🛠️ 2. 자세 경고 횟수 (명세서의 data.pose_summary 활용)
          // 'GOOD_POSTURE'가 아닌 항목들의 count만 골라서 모두 더해줍니다.
          const totalWarnings = pose_summary
            .filter(pose => pose.pose_status !== 'GOOD_POSTURE')
            .reduce((sum, pose) => sum + pose.count, 0);

          // 💡 상태(State)에 가공된 데이터를 예쁘게 담아줍니다.
          setReportData({
            summary: {
              date: session.imm_date,
              time: `${hrs}:${mins}:${secs}`,
              score: session.imm_score || 0,
              warnings: totalWarnings,
              // 명세서의 data.noise_summary.main_obstacle 활용 (가장 방해된 소음)
              mainNoise: noise_summary.main_obstacle || "없음"
            },
            // 🚨 차트용 배열 데이터는 아직 백엔드에 없으므로 임시 데이터를 유지합니다.
            chart: {
              labels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
              scores: [80, 85, 92, 60, 88, 95, 90],
              noises: [40, 38, 45, 65, 42, 35, 40]
            }
          });
        } else {
          setReportData(null);
        }
      } catch (error) {
        console.error("데이터 로드 중 오류 발생:", error);
        setReportData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [imm_idx]);

  // [UI] 로딩 중 화면
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-bold animate-pulse">데이터를 분석 중입니다...</p>
        </div>
      </div>
    );
  }

  // [UI] 데이터 없음 화면 (Empty State)
  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 animate-fade-in">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-sm border border-slate-100 text-center">
          <div className="text-6xl mb-6">📊</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">분석된 데이터가 없습니다</h2>
          <p className="text-slate-500 mb-8 font-medium leading-relaxed">
            아직 기록된 집중 세션이 없거나 세션을 찾을 수 없습니다. <br />
            대시보드에서 새로운 측정을 시작해 보세요!
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            대시보드로 이동하기
          </button>
        </div>
      </div>
    );
  }

  // [UI] 메인 리포트 화면 및 차트 옵션
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, max: 100, border: { dash: [4, 4] }, grid: { color: '#f1f5f9' } },
      x: { grid: { display: false } }
    },
    interaction: { intersect: false, mode: 'index' },
  };

  const lineData = {
    labels: reportData.chart.labels,
    datasets: [
      {
        label: '몰입도 (%)',
        data: reportData.chart.scores,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
      },
      {
        label: '소음 (dB)',
        data: reportData.chart.noises,
        borderColor: '#94a3b8',
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 0,
      }
    ]
  };

  // [기존 코드 - 삭제]
  // const formattedDate = reportData.summary.date 
  //   ? reportData.summary.date.split('T')[0].replace(/-/g, '. ')
  //   : '날짜 정보 없음';

  // 🚀 [수정된 코드 - 복사해서 붙여넣기]
  let formattedDate = '날짜 정보 없음';
  if (reportData.summary.date) {
    // 서버에서 온 시간을 한국 시간(+9시간)이 적용된 Date 객체로 변환
    const d = new Date(reportData.summary.date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    formattedDate = `${year}. ${month}. ${day}`;
  }
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-6 md:p-10 font-sans animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Analytics Report</h2>
          <p className="text-slate-500 font-medium">나의 집중 패턴과 자세 분석 결과를 확인하세요.</p>
        </div>
        <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold shadow-sm text-slate-600 flex items-center gap-2 cursor-default">
          📅 측정일 ({formattedDate})
        </div>
      </div>

      {/* 요약 통계 카드 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: '총 집중 시간', value: reportData.summary.time, unit: '', icon: '⏱️', color: 'text-indigo-600' },
          { label: '평균 몰입도', value: reportData.summary.score, unit: '점', icon: '⚡', color: 'text-emerald-500' },
          { label: '자세 경고 횟수', value: reportData.summary.warnings, unit: '회', icon: '🚨', color: 'text-rose-500' },
          { label: '주요 방해 소음', value: reportData.summary.mainNoise, unit: '', icon: '🎧', color: 'text-amber-500' } // 명세서 반영하여 카드 1개 추가
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow cursor-default">
            <div className={`w-14 h-14 min-w-[56px] rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-slate-100 ${item.color}`}>
              {item.icon}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-400 mb-1">{item.label}</p>
              <p className="text-2xl font-bold text-slate-800 tracking-tight truncate">
                {item.value}<span className="text-lg text-slate-400 font-medium ml-1">{item.unit}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 차트 섹션 */}
      <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800">시간대별 몰입 트렌드</h3>
          <div className="flex gap-4 text-sm font-bold text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>몰입도</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>소음</span>
          </div>
        </div>
        <div className="h-[350px] w-full">
          <Line data={lineData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}