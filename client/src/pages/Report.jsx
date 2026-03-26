import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Report() {
  // 💡 백엔드 연동 전 화면 디자인을 위한 더미 데이터
  const dummyData = {
    summary: {
      time: "03:45:20",
      score: 88,
      warnings: 5
    },
    chart: {
      labels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
      scores: [80, 85, 92, 60, 88, 95, 90],
      noises: [40, 38, 45, 65, 42, 35, 40]
    },
    logs: [
      { id: 1, time: '14:20', type: 'GOOD', msg: '바른 자세를 아주 잘 유지하고 있습니다.' },
      { id: 2, time: '11:45', type: 'WARNING', msg: '거북목 자세가 감지되었습니다. 허리를 펴주세요.' },
      { id: 3, time: '11:30', type: 'NOISE', msg: '주변 소음이 증가하여 몰입도가 하락했습니다.' },
    ]
  };

  // 차트 디자인 설정 (깔끔한 라인과 부드러운 곡선)
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 13, family: 'pretendard' },
        bodyFont: { size: 13, family: 'pretendard' },
        cornerRadius: 8,
      }
    },
    scales: { 
      y: { beginAtZero: true, max: 100, border: { dash: [4, 4] }, grid: { color: '#f1f5f9' } },
      x: { grid: { display: false } }
    },
    interaction: { intersect: false, mode: 'index' },
  };

  const lineData = {
    labels: dummyData.chart.labels,
    datasets: [
      {
        label: '몰입도 (%)',
        data: dummyData.chart.scores,
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
        data: dummyData.chart.noises,
        borderColor: '#94a3b8',
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 0,
      }
    ]
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-6 md:p-10 font-sans animate-fade-in">
      
      {/* 1. 페이지 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Analytics Report</h2>
          <p className="text-slate-500 font-medium">나의 집중 패턴과 자세 분석 결과를 확인하세요.</p>
        </div>
        <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold shadow-sm text-slate-600 flex items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors">
          📅 오늘 (2026.03.26) 
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>

      {/* 2. 최상단 요약 카드 (Summary) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: '총 집중 시간', value: dummyData.summary.time, unit: '', icon: '⏱️', color: 'text-indigo-600' },
          { label: '평균 몰입도', value: dummyData.summary.score, unit: '%', icon: '⚡', color: 'text-emerald-500' },
          { label: '자세 경고 횟수', value: dummyData.summary.warnings, unit: '회', icon: '🚨', color: 'text-rose-500' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
            <div className={`w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-slate-100 ${item.color}`}>
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-400 mb-1">{item.label}</p>
              <p className="text-2xl font-bold text-slate-800 tracking-tight">
                {item.value}<span className="text-lg text-slate-400 font-medium ml-1">{item.unit}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. 메인 콘텐츠 (차트 & 로그) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 그래프 섹션 */}
        <div className="lg:col-span-2 bg-white p-7 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">시간대별 몰입 트렌드</h3>
            <div className="flex gap-4 text-sm font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>몰입도</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>소음</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>

        {/* AI 피드백 타임라인 섹션 */}
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[400px] lg:h-auto">
          <h3 className="text-lg font-bold text-slate-800 mb-6">AI 코칭 타임라인</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-5">
            {dummyData.logs.map(log => (
              <div key={log.id} className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full mt-1.5 ring-4 ring-white ${log.type === 'GOOD' ? 'bg-emerald-400' : log.type === 'WARNING' ? 'bg-rose-400' : 'bg-amber-400'}`}></div>
                  <div className="w-0.5 h-full bg-slate-100 mt-2 group-last:hidden"></div>
                </div>
                <div className="pb-4">
                  <span className="text-xs font-bold text-slate-400 mb-1 block">{log.time}</span>
                  <p className="text-sm font-medium text-slate-700 leading-snug">{log.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}