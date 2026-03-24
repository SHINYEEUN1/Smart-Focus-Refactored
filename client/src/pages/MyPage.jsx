import React from 'react';
import Card from '../components/Card';

export default function MyPage() {
  const badges = [
    { name: "첫 몰입 성공", icon: "🎯", unlocked: true }, { name: "바른 자세 지킴이", icon: "🧘‍♂️", unlocked: true },
    { name: "소음 방어 마스터", icon: "🎧", unlocked: false }, { name: "몰입의 달인", icon: "👑", unlocked: false },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-in py-12 px-4 md:px-0">
      <h2 className="text-3xl font-black text-slate-800 tracking-tight border-b border-slate-200 pb-6 mt-4">마이 페이지</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-[#312E81] rounded-3xl p-12 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#4F46E5] rounded-full blur-[100px] opacity-40 -mr-20 -mt-20"></div>
          <div className="flex flex-col md:flex-row items-center gap-6 z-10">
            <div className="w-28 h-28 bg-white/20 backdrop-blur-xl rounded-[2.5rem] flex items-center justify-center text-5xl border border-white/30 shadow-inner">🧑‍💻</div>
            <div className="text-center md:text-left">
              <div className="inline-block px-4 py-1.5 bg-[#4F46E5] rounded-full text-[0.65rem] font-black tracking-[0.2em] mb-4 border border-white/10 shadow-sm">FOCUS RUNNER</div>
              <h3 className="text-4xl font-black tracking-tight mb-2">홍길동님</h3>
              <p className="text-indigo-200 font-bold opacity-80">포커스 러너 등급: 마스터</p>
            </div>
          </div>
        </div>
        <Card className="flex flex-col justify-center items-center text-center rounded-[3rem] p-10 bg-slate-50/50 hover:shadow-lg transition-shadow">
          <p className="text-sm font-black text-slate-400 mb-2 uppercase tracking-widest border-b border-slate-100 pb-2 w-full text-center mb-6">보유 포인트</p>
          <p className="text-5xl font-black text-[#5B44F2] mb-1">1,250</p>
          <p className="text-xs font-bold text-slate-400">이번 달 +240pt</p>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="rounded-[3rem] p-10 hover:shadow-lg transition-shadow">
          <h3 className="font-black text-slate-800 text-xl mb-8 flex items-center gap-2"><div className="w-2 h-6 bg-[#FE5C20] rounded-full"></div>목표 달성 현황</h3>
          <div className="space-y-6">
            {['이번 주 총 몰입 시간', '평균 집중 점수', '자세 교정 목표'].map((g, i) => (
                <div key={i}><p className="text-sm font-bold text-slate-600 mb-2">{g}</p><div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden"><div style={{width: `${70 + i * 10}%`}} className="h-full transition-all duration-500 ease-out bg-[#FF8C60]"></div></div></div>
            ))}
          </div>
        </Card>
        <Card className="rounded-[3rem] p-10 hover:shadow-lg transition-shadow">
          <h3 className="font-black text-slate-800 text-xl mb-8 flex items-center gap-2"><div className="w-2 h-6 bg-[#5B44F2] rounded-full"></div>전체 획득 뱃지</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {badges.map((b, i) => (
              <div key={i} className={`p-4 rounded-2xl border flex flex-col items-center justify-center transition-all ${b.unlocked ? 'bg-indigo-50/50 border-indigo-100 hover:-translate-y-1' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}><span className="text-3xl mb-2 drop-shadow-sm">{b.icon}</span><span className="text-xs font-bold text-slate-700 whitespace-nowrap">{b.name}</span></div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="rounded-[3rem] p-10 hover:shadow-lg transition-shadow border-slate-100">
        <h3 className="font-black text-slate-800 text-xl mb-8 flex items-center gap-2"><div className="w-2 h-6 bg-slate-400 rounded-full"></div>환경 설정</h3>
        <div className="space-y-6 max-w-2xl">
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm font-bold text-slate-700">소음 경고 데시벨 설정</label><span className="text-sm font-bold text-[#5B44F2] bg-indigo-50 px-3 py-1 rounded-md">60 dB</span>
          </div>
          <input type="range" min="40" max="90" defaultValue="60" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#5B44F2]" />
          <div className="flex justify-between text-xs text-slate-400 mt-3 font-bold"><span>조용함</span><span>시끄러움</span></div>
        </div>
      </Card>
    </div>
  );
}