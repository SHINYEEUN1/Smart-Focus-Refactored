import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

/* src/app 위치에서 한 단계 상위(src) 폴더의 App.css를 참조합니다. */
import '../App.css';

/* 각 계층으로 이동된 파일들의 상대 경로를 FSD 규격에 맞게 재설정했습니다. */
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

  /* 초기 로딩 시 서버로부터 로그인 세션 정보를 동기화합니다. */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('http://localhost:3000/auth/check', {
          method: 'GET',
          credentials: 'include' 
        });
        const data = await res.json();
        
        if (data.success && data.user_info) {
          localStorage.setItem('user_info', JSON.stringify(data.user_info));
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('user_info');
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("세션 동기화 실패:", err);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3000/user/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('user_info');
      setIsLoggedIn(false);
      navigate('/');
    } catch (err) {
      console.error("로그아웃 처리 오류:", err);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen">
      {/* 프리미엄 다크 네이비 테마가 적용된 고정 헤더 영역입니다. */}
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
          <Route path="/mypage" element={<MyPage />} />
        </Routes>
      </main>
    </div>
  );
}