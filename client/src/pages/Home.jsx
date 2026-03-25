import React from 'react';
import Card from '../components/Card';

export default function Home({ onStart }) {
  return (
    <div className="flex items-center justify-center min-h-[85vh] animate-fade-in">
      <Card className="max-w-2xl w-full text-center p-12 py-20 border-none shadow-2xl rounded-[3rem]">
        <div className="inline-block px-5 py-2 bg-indigo-50 text-indigo-600 rounded-full font-black text-sm mb-6 tracking-widest shadow-sm">
          Smart Focus
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 leading-tight tracking-tight">
          당신의 몰입을 위한<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5B44F2] to-[#818CF8]">지능형 AI 코치</span>
        </h1>
        <p className="text-slate-500 text-lg mb-10 leading-relaxed font-medium">
          자세 분석과 소음 모니터링으로 최적의 집중 환경을 구축하세요.
        </p>
        <button onClick={onStart} className="px-12 py-5 bg-[#5B44F2] text-white rounded-2xl font-black text-xl shadow-xl shadow-indigo-200 hover:scale-105 hover:bg-[#4a36c4] transition-all">
          지금 바로 시작하기
        </button>
      </Card>
    </div>
  );
}