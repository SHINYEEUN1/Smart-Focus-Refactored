import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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

export default function App() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  /* 다크 모드 상태 (기본값: 라이트모드) */
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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
      } catch (err) {
        if (err.response?.status !== 401) {
          console.error("세션 인증 프로세스 중 예외 발생:", err);
        }
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      localStorage.removeItem('user_info');
      setIsLoggedIn(false);
      navigate('/');
    } catch (err) {
      console.error("로그아웃 요청 중 오류 발생:", err);
    }
  };

  if (isLoading) return null;

  return (
    <ErrorBoundary>
      <style>{`html { overflow-y: scroll !important; }`}</style>
      <div className="min-h-screen transition-colors duration-300">
        <header className="px-8 py-5 flex justify-between items-center bg-slate-900 dark:bg-slate-950 border-b border-slate-800 dark:border-slate-900 sticky top-0 z-50 transition-colors">
          <div onClick={() => navigate('/')} className="cursor-pointer hover:opacity-80 transition-opacity">
            <Logo />
          </div>
          <div className="flex items-center gap-4">
            {!isLoggedIn ? (
              <div className="flex gap-2">
                <button onClick={() => navigate('/login')} className="px-5 py-2.5 rounded-xl text-sm font-black text-indigo-200 hover:text-white transition-colors">로그인</button>
                <button onClick={() => navigate('/signup')} className="px-5 py-2.5 bg-[#5B44F2] text-white rounded-xl text-sm font-black shadow-lg hover:bg-[#4a36c4] transition-colors">회원가입</button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button onClick={() => navigate('/dashboard')} className="text-slate-300 hover:text-white font-bold text-sm transition-colors">대시보드</button>
                <button onClick={() => navigate('/report')} className="text-slate-300 hover:text-white font-bold text-sm transition-colors">분석 리포트</button>
                <button onClick={() => navigate('/mypage')} className="text-slate-300 hover:text-white font-bold text-sm transition-colors">마이페이지</button>
                <button onClick={handleLogout} className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all ml-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
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
            <Route path="/mypage" element={<MyPage isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />} />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
}