import React from 'react';

export default function Logo({ isDarkBg = true }) {
  const brandColor = isDarkBg ? 'text-indigo-400' : 'text-indigo-600';
  const titleColor = isDarkBg ? 'text-white' : 'text-slate-950';

  return (
    <div className="flex items-center gap-x-3.5 select-none">
      
      {/* 1. 육각형(Hexagon) 심볼 영역 */}
      <div className="relative flex items-center justify-center w-12 h-12 flex-shrink-0">
        {/* 하단 잘림 방지용 viewBox 유지 */}
        <svg 
          viewBox="-1 -1 26 26" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={`absolute inset-0 w-full h-full overflow-visible ${brandColor}`}
        >
          <path d="M12 2.5L20.22 7.25V16.75L12 21.5L3.78 16.75V7.25L12 2.5Z"></path>
        </svg>
        
        {/* 내부 SF 텍스트 (원본처럼 가로 정렬로 완벽 복구) */}
        <span className={`absolute z-10 font-black text-lg ${brandColor}`}>
          SF
        </span>
      </div>
      
      {/* 2. 타이틀 및 서브타이틀 텍스트 영역 */}
      <div className="flex flex-col justify-center">
        <span className={`font-black text-2xl tracking-tight leading-none ${titleColor}`}>
          Smart Focus
        </span>
        <span className={`text-[10px] uppercase font-semibold tracking-[0.2em] mt-1.5 ${brandColor}`}>
          AI POSTURE & FOCUS COACH
        </span>
      </div>
    </div>
  );
}