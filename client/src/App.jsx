import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './App.css';

import Logo from './components/Logo';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Report from './pages/Report';
import MyPage from './pages/MyPage';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation(); 

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // 소셜 로그인 리다이렉트 후 서버 세션 확인 (쿠키 전송 필수)
        const res = await fetch('http://localhost:3000/auth/check', {
          method: 'GET',
          credentials: 'include' 
        });
        const data = await res.json();
        
        if (data.success && data.user_info) {
          // 서버 세션 정보를 로컬 스토리지에 동기화
          localStorage.setItem('user_info', JSON.stringify(data.user_info));
          setIsLoggedIn(true);
        } else {
          // 세션 만료 또는 비회원 시 기존 데이터 정리
          localStorage.removeItem('user_info');
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("세션 동기화 에러:", err);
        localStorage.removeItem('user_info');
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
  }, []); 

  const handleLogout = async () => {
    try {
      const res = await fetch('http://localhost:3000/user/logout', {
        method: 'POST',
        credentials: 'include' 
      });
      const data = await res.json();
      
      if (data.success) {
        alert("성공적으로 로그아웃 되었습니다.");
        localStorage.removeItem('user_info'); // 다른 아이디 로그인 시 닉네임 꼬임 방지
        setIsLoggedIn(false);
        navigate('/'); 
      }
    } catch (err) {
      console.error("로그아웃 에러:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">
        사용자 정보를 확인 중입니다...
      </div>
    );
  }

  const handleNavigate = (page) => {
    if (page === 'home') navigate('/');
    else navigate(`/${page}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100">
      
      <header className="px-8 py-5 flex justify-between items-center bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
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

              <button onClick={handleLogout} className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all ml-2" title="로그아웃">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              </button>
            </div>
          )}
        </div>
      </header>
      
      <main>
        <Routes>
          <Route path="/" element={<Home onStart={() => navigate(isLoggedIn ? '/dashboard' : '/signup')} />} />
          <Route path="/login" element={<Login onNavigate={handleNavigate} setIsLoggedIn={setIsLoggedIn} />} />
          <Route path="/signup" element={<SignUp onNavigate={handleNavigate} setIsLoggedIn={setIsLoggedIn} />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<Report />} />
          <Route path="/report/:imm_idx" element={<Report />} />
          <Route path="/mypage" element={<MyPage />} />
        </Routes>
      </main>
    </div>
  );
}