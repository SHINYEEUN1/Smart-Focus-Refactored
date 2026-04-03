import React from 'react';

/* --- 기능 아이콘 컴포넌트 --- */
const VisionIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3" /><path d="M7 12h10" /><path d="M12 7v10" />
  </svg>
);

const SoundIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1v22" /><path d="M17 5v14" /><path d="M2 9v6" /><path d="M22 9v6" /><path d="M7 5v14" />
  </svg>
);

const AnalysisIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

export default function Home({ onStart }) {
  return (
    <div className="flex items-center justify-center min-h-[85vh] p-6 animate-fade-in">
      <div className="max-w-4xl w-full text-center p-12 py-20 md:p-20 md:py-28 bg-white border border-slate-200 shadow-2xl shadow-slate-200/50 rounded-[3.5rem] transition-all">
        
        <div className="inline-block px-6 py-2.5 bg-indigo-50 text-[#5B44F2] rounded-full font-black text-xs md:text-sm mb-10 tracking-[0.1em] shadow-sm border border-indigo-100 uppercase">
          AI 자세 & 집중 코치
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-10 leading-[1.1] tracking-tighter">
          당신의 집중을 위한<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5B44F2] via-[#6366f1] to-[#818CF8]">
            지능형 AI 코치
          </span>
        </h1>

        <p className="text-slate-500 text-lg md:text-xl mb-14 leading-relaxed font-semibold break-keep max-w-2xl mx-auto">
          복잡한 설정 없이 카메라만 켜세요. <br className="hidden md:block" />
          실시간 자세 분석과 소음 탐지로 당신만의 완벽한 집중 환경을 만듭니다.
        </p>

        <div className="flex justify-center">
          <button 
            onClick={onStart} 
            className="group relative px-12 py-5 md:px-16 md:py-6 bg-[#5B44F2] text-white rounded-3xl font-black text-xl md:text-2xl shadow-2xl shadow-indigo-200 hover:bg-[#4a36c4] hover:-translate-y-1 active:scale-95 transition-all duration-300 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-3">
              지금 바로 시작하기
              <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
          </button>
        </div>

        <div className="mt-24 grid grid-cols-3 gap-4 max-w-lg mx-auto border-t border-slate-50 pt-12">
          <div className="flex flex-col items-center gap-4 group">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-[#5B44F2] transition-all duration-300 border border-slate-100 shadow-sm">
              <VisionIcon />
            </div>
            <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase group-hover:text-slate-600 transition-colors">자세 교정 AI</span>
          </div>
          <div className="flex flex-col items-center gap-4 group border-x border-slate-100 px-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-[#5B44F2] transition-all duration-300 border border-slate-100 shadow-sm">
              <SoundIcon />
            </div>
            <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase group-hover:text-slate-600 transition-colors">환경 소음 차단</span>
          </div>
          <div className="flex flex-col items-center gap-4 group">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-[#5B44F2] transition-all duration-300 border border-slate-100 shadow-sm">
              <AnalysisIcon />
            </div>
            <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase group-hover:text-slate-600 transition-colors">집중 데이터 분석</span>
          </div>
        </div>
      </div>
    </div>
  );
}