import React from 'react';
import { authApi } from '../shared/api';

/**
 * [로그인 페이지]
 * - 이메일 기반 로컬 로그인 처리 및 다크모드 UI 대응 완비
 * - OAuth 2.0 기반 소셜 로그인(네이버, 카카오, 구글) 연동
 */
export default function Login({ onNavigate, setIsLoggedIn }) {
  /* 로컬 이메일/비밀번호 검증 및 세션 발급 요청 */
  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const pwd = e.target.pwd.value;
    try {
      const data = await authApi.login({ email, pwd });
      if (data && data.success && data.data?.user) {
        localStorage.setItem('user_info', JSON.stringify(data.data.user));
        setIsLoggedIn(true);
        onNavigate('dashboard');
      } else {
        alert(data?.message || "아이디 또는 비밀번호를 확인해주세요.");
      }
    } catch (err) {
      alert("서버 통신 중 오류가 발생했습니다.");
    }
  };

  /* 소셜 로그인 프로바이더(Provider) 리다이렉션 라우팅 */
  const handleSocialLogin = (provider) => {
    const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    window.location.href = `${BASE_URL}/auth/${provider}`;
  };

  return (
    // 다크모드 시 최상위 배경 투명화 처리로 App.css의 메쉬 그라데이션 노출
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-transparent p-6 font-sans transition-colors duration-300">
      <div className="perspective-container group w-full max-w-[1100px]">
        {/* 3D 카드 컨테이너 */}
        <div className="login-card-3d relative flex bg-white dark:bg-slate-900/80 rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-700 backdrop-blur-md">
          
          {/* 좌측 배너 영역 (데스크톱 전용) */}
          <div className="hidden lg:flex flex-col justify-center p-16 bg-gradient-to-br from-[#eef2ff] to-[#e0e7ff] dark:from-indigo-950/40 dark:to-slate-900/40 border-r border-slate-100 dark:border-slate-800/50 w-5/12 transition-colors">
            <h2 className="text-[3.2rem] font-black text-[#4f46e5] dark:text-indigo-400 leading-[1.1] mb-6 tracking-tighter">
              다시 집중의<br />시간으로
            </h2>
            <p className="text-[#64748b] dark:text-slate-400 font-semibold text-base leading-relaxed break-keep">
              실시간 AI 분석으로 사용자님의 집중을 돕는<br />지능형 포커스 코치, SMART FOCUS입니다.
            </p>
          </div>

          {/* 우측 로그인 폼 영역 */}
          <div className="flex-1 p-10 md:p-16">
            <div className="mb-10 text-center md:text-left">
              <h1 className="text-3xl font-black text-[#0f172a] dark:text-white mb-2 tracking-tight transition-colors">로그인</h1>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">성장 기록을 위해 계정에 접속하세요.</p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em] block mb-2 px-1">Email Account</label>
                <input 
                  type="email" 
                  name="email" 
                  placeholder="focus@chrono.com" 
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 focus:border-[#5B44F2] dark:focus:border-indigo-400 transition-all font-bold text-sm text-slate-900 dark:text-white" 
                  required 
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em] block mb-2 px-1">Password</label>
                <input 
                  type="password" 
                  name="pwd" 
                  placeholder="••••••••" 
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 focus:border-[#5B44F2] dark:focus:border-indigo-400 transition-all font-bold text-sm text-slate-900 dark:text-white" 
                  required 
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-4 bg-[#5B44F2] text-white rounded-2xl font-black text-base shadow-lg hover:bg-[#4a36c4] hover:-translate-y-0.5 active:scale-[0.98] transition-all"
              >
                접속하기
              </button>
            </form>

            <div className="relative my-10 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800"></div></div>
              <span className="relative px-6 bg-white dark:bg-slate-900 text-[11px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">Connect with Social</span>
            </div>

            <div className="space-y-3">
              <button 
                type="button" 
                onClick={() => handleSocialLogin('naver')} 
                className="w-full py-3.5 bg-[#03C75A] text-white rounded-xl font-bold text-sm hover:brightness-95 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <span className="bg-white text-[#03C75A] w-5 h-5 rounded-sm flex items-center justify-center font-black text-[10px]">N</span>
                네이버로 로그인
              </button>
              
              <button 
                type="button" 
                onClick={() => handleSocialLogin('kakao')} 
                className="w-full py-3.5 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-bold text-sm hover:brightness-95 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" className="w-5 h-5" alt="Kakao" />
                카카오로 로그인
              </button>

              <button 
                type="button" 
                onClick={() => handleSocialLogin('google')} 
                className="w-full py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-sm"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                Google로 로그인
              </button>
            </div>

            <div className="text-center mt-12">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                SMART FOCUS가 처음이신가요? 
                <button onClick={() => onNavigate('signup')} className="ml-2 text-[#5B44F2] dark:text-indigo-400 font-black hover:underline underline-offset-4">회원가입</button>
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .perspective-container { perspective: 2000px; }
        .login-card-3d { transform-style: preserve-3d; }
        .perspective-container:hover .login-card-3d {
          transform: rotateX(2deg) rotateY(-2deg);
        }
      `}</style>
    </div>
  );
}