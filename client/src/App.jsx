import React, { useState } from 'react';
import './App.css';

// 💡 방금 우리가 쪼개서 만든 파일들을 다 불러옵니다!
import Logo from './components/Logo';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Report from './pages/Report';
import MyPage from './pages/MyPage';

export default function App() {
  const [activePage, setActivePage] = useState('home');

  return (
    <div className="min-h-screen bg-[#Eef2f6] font-sans selection:bg-indigo-100">
      
      <header className="bg-[#24223E] px-8 py-5 flex justify-between items-center shadow-xl sticky top-0 z-50 border-b border-white/5">
        <div onClick={() => setActivePage('home')}>
          <Logo />
        </div>
        
        <nav className="hidden md:flex space-x-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
          {[
            { id: 'dashboard', l: '대시보드' },
            { id: 'report', l: '분석 리포트' },
            { id: 'mypage', l: '마이페이지' }
          ].map((nav) => (
            <button 
              key={nav.id} 
              onClick={() => setActivePage(nav.id)}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activePage === nav.id ? 'bg-[#5B44F2] text-white shadow-xl' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              {nav.l}
            </button>
          ))}
        </nav>

        <div className="flex gap-4 items-center">
          {['home', 'login', 'signup'].includes(activePage) ? (
            <div className="flex gap-4">
              <button onClick={() => setActivePage('login')} className="text-sm font-black text-indigo-200 hover:text-white transition-colors">로그인</button>
              <button onClick={() => setActivePage('signup')} className="px-5 py-2.5 bg-[#5B44F2] text-white rounded-xl text-sm font-black shadow-lg hover:bg-[#4a36c4] transition-colors">회원가입</button>
            </div>
          ) : (
            <button onClick={() => setActivePage('home')} className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all" title="로그아웃">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          )}
        </div>
      </header>
      
      <main>
        {activePage === 'home' && <Home onStart={() => setActivePage('signup')} />}
        {activePage === 'login' && <Login onNavigate={setActivePage} />}
        {activePage === 'signup' && <SignUp onNavigate={setActivePage} />}
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'report' && <Report />}
        {activePage === 'mypage' && <MyPage />}
      </main>
    </div>
  );
}