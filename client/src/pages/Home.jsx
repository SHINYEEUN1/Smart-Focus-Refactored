import React from 'react';

/**
 * [랜딩 페이지]
 * - 다크모드 대응 완료 (dark: 접두어 기반 클래스 정밀 매핑)
 * - 시인성 확보를 위한 selection 가상 요소 적용
 */
export default function Home({ onStart }) {
  return (
    <div className="relative flex items-center justify-center min-h-[90vh] p-6 overflow-hidden bg-[#f8fafc] dark:bg-transparent transition-colors duration-300 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50">
      
      {/* 배경 장식: 하이테크 링 애니메이션 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-[400px] h-[400px] border border-indigo-200/40 dark:border-indigo-500/20 rounded-full animate-pulse-slow"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] border border-indigo-100/30 dark:border-indigo-500/10 rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] border border-indigo-50/20 dark:border-indigo-500/5 rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-radial-indigo-glow opacity-40 dark:opacity-20 blur-[80px]"></div>
      </div>

      <div className="relative z-10 max-w-4xl w-full text-center">
        <div className="inline-block px-5 py-2 bg-white dark:bg-slate-800/50 text-[#5B44F2] dark:text-indigo-400 rounded-full font-black text-[10px] mb-8 tracking-[0.2em] border border-indigo-100 dark:border-indigo-500/30 shadow-sm uppercase backdrop-blur-sm">
          SMART FOCUS
        </div>

        {/* 텍스트 다크모드 대응: 글자색 반전 및 가독성 확보 */}
        <h1 className="text-6xl md:text-8xl font-black text-slate-900 dark:text-white mb-10 leading-[1.1] tracking-tighter drop-shadow-sm selection:text-indigo-900 dark:selection:text-indigo-300 transition-colors">
          당신의 집중에<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5B44F2] via-[#7c3aed] to-[#818CF8] selection:text-indigo-600 dark:selection:text-white">
            기술을 더하다
          </span>
        </h1>

        <p className="text-slate-500 dark:text-slate-300 text-lg md:text-xl mb-16 leading-relaxed font-bold max-w-2xl mx-auto opacity-80 break-keep selection:text-slate-900 dark:selection:text-white transition-colors">
          별도의 하드웨어 없이 카메라만 켜세요. <br className="hidden md:block" />
          실시간 AI 자세 분석과 소음 탐지로 당신만의 완벽한 집중 환경을 만듭니다.
        </p>

        <div className="flex justify-center mb-24">
          <button 
            onClick={onStart} 
            className="group relative px-16 py-6 bg-[#5B44F2] text-white rounded-[2.5rem] font-black text-2xl shadow-[0_20px_50px_-10px_rgba(91,68,242,0.5)] dark:shadow-[0_20px_50px_-10px_rgba(91,68,242,0.3)] hover:bg-[#4a36c4] hover:-translate-y-1.5 transition-all duration-300 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-4">
              지금 바로 시작하기
              <svg className="w-7 h-7 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/20 group-hover:animate-shine" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-10 max-w-2xl mx-auto border-t border-slate-100 dark:border-slate-800/50 pt-16 transition-colors">
          {[
            { label: '정밀 자세 분석', icon: "M5 13l4 4L19 7" },
            { label: '실시간 소음 관리', icon: "M12 1v22M17 5v14M2 9v6M22 9v6M7 5v14" },
            { label: 'AI 맞춤 리포트', icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2" }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-4 group cursor-default">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-500/30 text-[#5B44F2] dark:text-indigo-400 flex items-center justify-center shadow-sm transition-all duration-300 group-hover:bg-[#5B44F2] group-hover:text-white group-hover:shadow-lg group-hover:-translate-y-1.5">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </div>
              <span className="text-[11px] font-black text-[#5B44F2] dark:text-indigo-400 tracking-widest uppercase opacity-90 transition-colors">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes shine { 100% { left: 200%; } }
        .animate-shine { animation: shine 1.5s infinite; }
        .bg-radial-indigo-glow { background: radial-gradient(circle, rgba(91,68,242,0.15) 0%, transparent 70%); }
        @keyframes pulse-slow { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } }
        .animate-pulse-slow { animation: pulse-slow 5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}