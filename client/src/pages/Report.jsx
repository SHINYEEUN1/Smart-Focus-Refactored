import React from 'react';
import Card from '../components/Card';

export default function Report() {
  const weeklyData = [
    { day: '월', score: 55 }, { day: '화', score: 72 }, { day: '수', score: 95 }, 
    { day: '목', score: 45 }, { day: '금', score: 88 }, { day: '토', score: 100 }, { day: '일', score: 65 }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in py-12 px-6">
      <div className="flex justify-between items-end border-b border-slate-200 pb-6 mt-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">분석 리포트</h2>
          <p className="text-slate-500 mt-2 font-bold text-lg">주간 나의 몰입 패턴을 시각적으로 확인하세요.</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 text-sm font-black text-slate-600 shadow-sm">📅 2026. 03. 23</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="bg-gradient-to-br from-[#5B44F2] to-[#7E69FF] text-white border-none p-10 shadow-lg shadow-[#5B44F2]/20">
          <p className="font-bold opacity-90 mb-2">총 몰입 시간</p>
          <p className="text-4xl font-black tracking-tighter">12.5h</p>
        </Card>
        <Card className="p-10 flex flex-col justify-center border-indigo-100 hover:shadow-md transition-shadow">
          <p className="text-slate-400 font-black mb-2 uppercase tracking-widest text-xs">평균 집중 점수</p>
          <p className="text-4xl font-black text-slate-900">88<span className="text-2xl ml-1 text-[#5B44F2]">%</span></p>
        </Card>
        <Card className="p-10 flex flex-col justify-center border-emerald-100 hover:shadow-md transition-shadow">
          <p className="text-emerald-500 font-black mb-2 uppercase tracking-widest text-xs">자세 개선율</p>
          <p className="text-4xl font-black text-emerald-500">+15<span className="text-2xl ml-1 text-emerald-500">%</span></p>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8 hover:shadow-md transition-shadow flex flex-col">
          <h3 className="font-black text-slate-800 text-xl mb-8 flex items-center gap-2"><div className="w-2 h-6 bg-[#5B44F2] rounded-full"></div>주간 몰입도 추이</h3>
          <div className="flex-grow bg-slate-50 rounded-3xl flex items-end justify-between p-6 px-8 min-h-[250px]">
             {weeklyData.map((data, i) => (
               <div key={i} className="flex flex-col items-center group w-full h-full justify-end">
                 <div className="w-full flex justify-center h-[200px] items-end relative">
                   <div style={{ height: `${data.score}%` }} className={`w-8 sm:w-10 rounded-t-xl transition-all duration-700 ease-out relative ${data.score < 50 ? 'bg-rose-400' : data.score < 75 ? 'bg-amber-400' : 'bg-[#5B44F2]'} opacity-85 group-hover:opacity-100`}>
                     <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg shadow-lg transition-opacity z-10">{data.score}점</div>
                   </div>
                 </div>
                 <span className="text-sm font-bold text-slate-400 mt-4 tracking-tight">{data.day}</span>
               </div>
             ))}
          </div>
        </Card>
        <Card className="p-8 border-indigo-100 hover:shadow-md transition-shadow flex flex-col">
          <h3 className="font-black text-slate-800 text-xl mb-8 flex items-center gap-2"><div className="w-2 h-6 bg-[#5B44F2] rounded-full"></div>상세 세션 로그</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
               <thead className="text-slate-400 font-bold border-b border-slate-100"><tr><th className="p-4 pl-2">일시</th><th className="p-4">유지 시간</th><th className="p-4">최종 점수</th></tr></thead>
               <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                 {[{ date: '2026.03.17', time: '5h', score: '80%' }, { date: '2026.03.18', time: '6h 30m', score: '82%' }, { date: '2026.03.19', time: '7h', score: '84%' }, { date: '2026.03.20', time: '8h 15m', score: '86%' }].map((log, i) => (
                   <tr key={i} className="hover:bg-slate-50 transition-colors"><td className="p-4 pl-2">{log.date}</td><td className="p-4 font-mono text-slate-500">{log.time}</td><td className="p-4 font-black text-slate-900">{log.score}</td></tr>
                 ))}
               </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}