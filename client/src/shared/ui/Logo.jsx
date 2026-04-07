import React from 'react';

/**
 * 서비스 공용 로고 컴포넌트
 * - 렌더링되는 배경의 명도(isDarkBg) 또는 전역 다크모드(dark class)에 따라
 * 텍스트 및 브랜드 심볼의 컬러셋을 동적으로 반전 처리
 */
export default function Logo({ isDarkBg = true }) {
  // 배경 또는 시스템 테마에 따른 브랜드 컬러 팔레트 동적 할당
  const brandColor = isDarkBg ? 'text-indigo-400' : 'text-indigo-600 dark:text-indigo-400';
  const titleColor = isDarkBg ? 'text-white' : 'text-slate-950 dark:text-white';

  return (
    <div className="flex items-center gap-x-3.5 select-none">
      
      {/* 육각형(Hexagon) 형태의 브랜드 심볼 마크 영역 */}
      <div className="relative flex items-center justify-center w-12 h-12 flex-shrink-0 transition-colors duration-300">
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
        
        {/* 로고 이니셜 */}
        <span className={`absolute z-10 font-black text-lg ${brandColor}`}>
          SF
        </span>
      </div>
      
      {/* 서비스명 및 브랜드 슬로건 텍스트 영역 */}
      <div className="flex flex-col justify-center transition-colors duration-300">
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