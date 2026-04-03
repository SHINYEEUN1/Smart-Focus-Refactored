import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 404 Not Found 페이지 컴포넌트
 */
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[85vh] p-6 animate-fade-in">
      <div className="max-w-2xl w-full text-center p-12 py-20 bg-white border border-slate-200 shadow-2xl rounded-[3rem]">
        <div className="text-8xl font-black text-slate-100 mb-6 select-none tracking-tighter">404</div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-6 tracking-tight">길을 잃으셨나요?</h1>
        <p className="text-slate-500 text-lg mb-12 leading-relaxed font-semibold break-keep">
          요청하신 페이지가 삭제되었거나 주소가 올바르지 않습니다.<br/>
          입력하신 주소를 다시 한번 확인해 주세요.
        </p>
        <button 
          onClick={() => navigate('/')} 
          className="px-12 py-4 bg-[#5B44F2] text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:scale-105 hover:bg-[#4a36c4] active:scale-95 transition-all"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}