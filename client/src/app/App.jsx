import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import '../App.css';
import { authApi } from '../shared/api';
import ErrorBoundary from '../shared/ui/ErrorBoundary';
import Logo from '../shared/ui/Logo';
import Home from '../pages/Home';
import Login from '../pages/Login';
import SignUp from '../pages/SignUp';
import Dashboard from '../pages/Dashboard';
import Report from '../pages/Report';
import MyPage from '../pages/MyPage';

/**
 * [애플리케이션 최상위 컨테이너]
 * - 전역 다크/라이트 모드 테마 관리 및 하위 페이지 상태 주입
 * - 초기 로드 시 세션 유효성 검증(자동 로그인 유지)
 * - GNB(Global Navigation Bar) 렌더링 및 페이지 라우팅 분기
 */
export default function App() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  /* 전역 테마 상태: 로컬 스토리지에서 이전 사용자 설정을 복구 */
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  /* 테마 상태 변경 시 DOM(html 태그)에 dark 클래스 토글 및 스토리지 동기화 */
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  /* 앱 초기화 시 서버에 세션 유효 여부를 질의하여 인증 상태 복구 */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await authApi.checkSession();
        if (data && data.success && data.data?.user) {
          localStorage.setItem('user_info', JSON.stringify(data.data.user));
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('user_info');
          setIsLoggedIn(false);
        }
      } catch (err) { setIsLoggedIn(false); } finally { setIsLoading(false); }
    };
    checkSession();
  }, []);

  /* 세션 종료 및 클라이언트 인증 정보 초기화 */
  const handleLogout = async () => {
    try {
      await authApi.logout();
      localStorage.removeItem('user_info');
      setIsLoggedIn(false);
      navigate('/');
    } catch (err) { console.error(err); }
  };

  if (isLoading) return null;

  return (
    <ErrorBoundary>
      <style>{`html { overflow-y: scroll !important; }`}</style>
      {/* 배경색 및 텍스트 색상 전환 시 부드러운 트랜지션 적용 */}
      <div className="min-h-screen transition-colors duration-300">
        <header className="px-8 py-5 flex justify-between items-center bg-slate-900 border-b border-slate-800 sticky top-0 z-50 transition-colors">
          <div onClick={() => navigate('/')} className="cursor-pointer hover:opacity-80 transition-opacity">
            <div className="uppercase tracking-tighter">
              <Logo />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!isLoggedIn ? (
              <div className="flex gap-2">
                <button onClick={() => navigate('/login')} className="px-5 py-2.5 rounded-xl text-[11px] font-black text-indigo-200 hover:text-white transition-colors uppercase tracking-[0.2em]">LOGIN</button>
                <button onClick={() => navigate('/signup')} className="px-5 py-2.5 bg-[#5B44F2] text-white rounded-xl text-[11px] font-black shadow-lg hover:bg-[#4a36c4] transition-colors uppercase tracking-[0.2em]">SIGN UP</button>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-white font-black text-[11px] transition-colors uppercase tracking-[0.25em]">DASHBOARD</button>
                <button onClick={() => navigate('/report')} className="text-slate-400 hover:text-white font-black text-[11px] transition-colors uppercase tracking-[0.25em]">REPORT</button>
                <button onClick={() => navigate('/mypage')} className="text-slate-400 hover:text-white font-black text-[11px] transition-colors uppercase tracking-[0.25em]">MY PAGE</button>
                <button onClick={handleLogout} className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all ml-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
              </div>
            )}
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Home onStart={() => navigate(isLoggedIn ? '/dashboard' : '/signup')} />} />
            <Route path="/login" element={<Login onNavigate={navigate} setIsLoggedIn={setIsLoggedIn} />} />
            <Route path="/signup" element={<SignUp onNavigate={navigate} setIsLoggedIn={setIsLoggedIn} />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report" element={<Report />} />
            <Route path="/report/:imm_idx" element={<Report />} />
            {/* 전역 테마 제어 함수를 MyPage에 주입 (Props Drilling) */}
            <Route path="/mypage" element={<MyPage isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />} />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
}