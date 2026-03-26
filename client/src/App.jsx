import React, { useState, useEffect } from 'react';
// 💡 1. URL 주소를 감지하고 이동시켜줄 리액트 라우터 도구들을 불러옵니다.
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
  // 💡 2. 이제 activePage 상태 대신 URL 주소를 직접 다룹니다.
  const navigate = useNavigate();
  const location = useLocation(); // 현재 URL 주소를 알 수 있는 도구

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 앱 실행 시 세션 체크
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('http://localhost:3000/user/check', {
          method: 'GET',
          credentials: 'include' 
        });
        const data = await res.json();
        
        if (data.success) {
          setIsLoggedIn(true);
          // 💡 처음 접속했을 때 루트 주소('/')일 경우에만 대시보드로 이동
          // (리포트 화면에서 새로고침 했을 때 튕기는 현상 방지)
          if (location.pathname === '/') {
            navigate('/dashboard');
          }
        } else {
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("세션 확인 에러:", err);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, [location.pathname]); // 주소가 바뀔 때마다 체크

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      const res = await fetch('http://localhost:3000/user/logout', {
        method: 'POST',
        credentials: 'include' 
      });
      const data = await res.json();
      
      if (data.success) {
        alert("성공적으로 로그아웃 되었습니다.");
        setIsLoggedIn(false);
        navigate('/'); // 💡 로그아웃 시 메인 화면('/')으로 이동
      }
    } catch (err) {
      console.error("로그아웃 에러:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#Eef2f6] flex items-center justify-center font-bold text-slate-500">
        사용자 정보를 확인 중입니다...
      </div>
    );
  }

  // 💡 기존 Login/SignUp 컴포넌트가 고장나지 않도록 연결해주는 헬퍼 함수
  const handleNavigate = (page) => {
    if (page === 'home') navigate('/');
    else navigate(`/${page}`);
  };

  return (
    <div className="min-h-screen bg-[#Eef2f6] font-sans selection:bg-indigo-100">
      <header className="bg-[#24223E] px-8 py-5 flex justify-between items-center shadow-xl sticky top-0 z-50 border-b border-white/5">
        <div className="flex-1 cursor-pointer" onClick={() => navigate('/')}>
          <Logo />
        </div>
        
        {isLoggedIn && (
          <nav className="hidden md:flex space-x-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
            {[
              { id: 'dashboard', l: '대시보드', path: '/dashboard' },
              { id: 'report', l: '분석 리포트', path: '/report' },
              { id: 'mypage', l: '마이페이지', path: '/mypage' }
            ].map((nav) => (
              <button 
                key={nav.id} 
                onClick={() => navigate(nav.path)} // 💡 메뉴 클릭 시 URL 변경
                // 💡 현재 URL 주소에 nav.path가 포함되어 있으면 보라색으로 활성화
                className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                  location.pathname.startsWith(nav.path) ? 'bg-[#5B44F2] text-white shadow-xl' : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {nav.l}
              </button>
            ))}
          </nav>
        )}

        <div className="flex-1 flex gap-4 items-center justify-end">
          {!isLoggedIn ? (
            <div className="flex gap-4">
              <button onClick={() => navigate('/login')} className="text-sm font-black text-indigo-200 hover:text-white transition-colors">로그인</button>
              <button onClick={() => navigate('/signup')} className="px-5 py-2.5 bg-[#5B44F2] text-white rounded-xl text-sm font-black shadow-lg hover:bg-[#4a36c4] transition-colors">회원가입</button>
            </div>
          ) : (
            <button onClick={handleLogout} className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all" title="로그아웃">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          )}
        </div>
      </header>
      
      <main>
        {/* 💡 3. 조건부 렌더링(if문) 대신 Routes를 사용하여 URL 주소에 맞는 컴포넌트만 띄워줍니다! */}
        <Routes>
          <Route path="/" element={<Home onStart={() => navigate(isLoggedIn ? '/dashboard' : '/signup')} />} />
          <Route path="/login" element={<Login onNavigate={handleNavigate} setIsLoggedIn={setIsLoggedIn} />} />
          <Route path="/signup" element={<SignUp onNavigate={handleNavigate} setIsLoggedIn={setIsLoggedIn} />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* 💡 /report 또는 /report/1 모두 처리할 수 있도록 라우트 분리 */}
          <Route path="/report" element={<Report />} />
          <Route path="/report/:imm_idx" element={<Report />} />
          
          <Route path="/mypage" element={<MyPage />} />
        </Routes>
      </main>
    </div>
  );
}