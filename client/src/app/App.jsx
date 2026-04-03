import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

/* src/app 위치에서 상위 폴더의 App.css 참조 */
import '../App.css';

/* FSD shared/api 계층 인증 API 모듈 호출 */
import { authApi } from '../shared/api';

/* 전역 에러 핸들링을 위한 ErrorBoundary 임포트 */
import ErrorBoundary from '../shared/ui/ErrorBoundary';

/* 각 계층으로 이동된 파일들의 상대 경로 설정 */
import Logo from '../shared/ui/Logo';
import Home from '../pages/Home';
import Login from '../pages/Login';
import SignUp from '../pages/SignUp';
import Dashboard from '../pages/Dashboard';
import Report from '../pages/Report';
import MyPage from '../pages/MyPage';

/**
 * 애플리케이션 메인 엔트리 컴포넌트
 * 세션 동기화 및 전역 라우팅을 관리하며, ErrorBoundary로 런타임 에러를 방어합니다.
 */
export default function App() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  /**
   * 초기 로딩 시 서버 세션 정보를 동기화합니다.
   * 비로그인 상태(401)는 에러가 아닌 정상 케이스로 처리하여 콘솔 노이즈를 방지합니다.
   */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await authApi.checkSession();
        
        /* 백엔드 shared 규격 반영: data.success가 true인 경우에만 로그인 처리 */
        if (data && data.success && data.data?.user) {
          localStorage.setItem('user_info', JSON.stringify(data.data.user));
          setIsLoggedIn(true);
        } else {
          /* 401 응답 등 인증 실패 시 세션 정보 초기화 */
          localStorage.removeItem('user_info');
          setIsLoggedIn(false);
        }
      } catch (err) {
        /* 네트워크 단절 등 실제 기술적 오류만 에러 로그로 남김 */
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

  /**
   * 로그아웃 핸들러
   * 서버 세션 종료 요청 후 로컬 스토리지를 비우고 홈으로 이동합니다.
   */
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

  /* 세션 체크 완료 전까지 빈 화면 노출로 깜빡임 방지 */
  if (isLoading) return null;

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <header className="px-8 py-5 flex justify-between items-center bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
          <div onClick={() => navigate('/')} className="cursor-pointer hover:opacity-80 transition-opacity">
            <Logo />
          </div>
          <div className="flex items-center gap-4">
            {!isLoggedIn ? (
              <div className="flex gap-2">
                <button 
                  onClick={() => navigate('/login')} 
                  className="px-5 py-2.5 rounded-xl text-sm font-black text-indigo-200 hover:text-white transition-colors"
                >
                  로그인
                </button>
                <button 
                  onClick={() => navigate('/signup')} 
                  className="px-5 py-2.5 bg-[#5B44F2] text-white rounded-xl text-sm font-black shadow-lg hover:bg-[#4a36c4] transition-colors"
                >
                  회원가입
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button onClick={() => navigate('/dashboard')} className="text-slate-300 hover:text-white font-bold text-sm transition-colors">대시보드</button>
                <button onClick={() => navigate('/report')} className="text-slate-300 hover:text-white font-bold text-sm transition-colors">분석 리포트</button>
                <button onClick={() => navigate('/mypage')} className="text-slate-300 hover:text-white font-bold text-sm transition-colors">마이페이지</button>
                <button 
                  onClick={handleLogout} 
                  className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all ml-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                  </svg>
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
    </ErrorBoundary>
  );
}