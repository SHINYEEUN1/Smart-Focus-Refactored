import React from 'react';

export default function Logo({ isDarkBg = true }) {
  return (
    <div className="flex items-center gap-3 cursor-pointer group">
      <svg viewBox="0 0 100 100" className="w-10 h-10 transform group-hover:scale-105 transition-transform duration-300">
        <polygon points="50 5, 93.3 30, 93.3 80, 50 105, 6.7 80, 6.7 30" fill="none" stroke="#818CF8" strokeWidth="8" strokeLinejoin="round"/>
        <text x="50" y="55" fontSize="42" fontWeight="900" fill="#818CF8" textAnchor="middle" dominantBaseline="middle" fontFamily="sans-serif">SF</text>
      </svg>
      <div className="flex flex-col leading-none mt-1 text-left">
        <span className={`font-black text-xl tracking-wide transition-colors ${isDarkBg ? 'text-white group-hover:text-[#818CF8]' : 'text-slate-800 group-hover:text-[#5B44F2]'}`}>
          Smart Focus
        </span>
        <span className="text-[0.55rem] font-bold tracking-[0.15em] text-[#818CF8] mt-1 uppercase">
          AI POSTURE & FOCUS COACH
        </span>
      </div>
    </div>
  );
}