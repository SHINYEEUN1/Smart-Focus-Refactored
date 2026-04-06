import React from 'react';
import { authApi } from '../shared/api';

/**
 * [최종 밸런스 조정] 
 * - 네이버, 카카오, 구글 소셜 로그인 버튼을 1:1:1 동일 사이즈로 맞춤
 * - 현경님 5-1 시안의 프리미엄 디자인 감성 유지
 * - [수정] '몰입' -> '집중' 문구 일괄 교체
 */
export default function Login({ onNavigate, setIsLoggedIn }) {
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

  const handleSocialLogin = (provider) => {
    const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    window.location.href = `${BASE_URL}/auth/${provider}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 font-sans">
      <div className="perspective-container group w-full max-w-[1100px]">
        <div className="login-card-3d relative flex bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden transition-all duration-700">
          
          <div className="hidden lg:flex flex-col justify-center p-16 bg-gradient-to-br from-[#eef2ff] to-[#e0e7ff] border-r border-slate-100 w-5/12">
            <h2 className="text-[3.2rem] font-black text-[#4f46e5] leading-[1.1] mb-6 tracking-tighter">
              다시 집중의<br />시간으로
            </h2>
            <p className="text-[#64748b] font-semibold text-base leading-relaxed break-keep">
              실시간 AI 분석으로 사용자님의 집중을 돕는<br />지능형 포커스 코치, SMART FOCUS입니다.
            </p>
          </div>

          <div className="flex-1 p-10 md:p-16">
            <div className="mb-10 text-center md:text-left">
              <h1 className="text-3xl font-black text-[#0f172a] mb-2 tracking-tight">로그인</h1>
              <p className="text-sm font-bold text-slate-400">성장 기록을 위해 계정에 접속하세요.</p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em] block mb-2 px-1">Email Account</label>
                <input 
                  type="email" 
                  name="email" 
                  placeholder="focus@chrono.com" 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-[#5B44F2] transition-all font-bold text-sm" 
                  required 
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em] block mb-2 px-1">Password</label>
                <input 
                  type="password" 
                  name="pwd" 
                  placeholder="••••••••" 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-[#5B44F2] transition-all font-bold text-sm" 
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
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <span className="relative px-6 bg-white text-[11px] font-black text-slate-300 uppercase tracking-widest">Connect with Social</span>
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
                className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-sm"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                Google로 로그인
              </button>
            </div>

            <div className="text-center mt-12">
              <p className="text-xs font-bold text-slate-400">
                SMART FOCUS가 처음이신가요? 
                <button onClick={() => onNavigate('signup')} className="ml-2 text-[#5B44F2] font-black hover:underline underline-offset-4">회원가입</button>
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