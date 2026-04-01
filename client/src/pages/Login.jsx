import React from 'react';
/* widgets 계층의 AuthLayout 컴포넌트를 참조하도록 경로를 수정했습니다. */
import AuthLayout from '../widgets/AuthLayout';

export default function Login({ onNavigate, setIsLoggedIn }) {
  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const pwd = e.target.pwd.value;

    try {
      const res = await fetch('http://localhost:3000/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, pwd })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (data.user_info) {
          localStorage.setItem('user_info', JSON.stringify(data.user_info));
        }
        setIsLoggedIn(true);
        onNavigate('dashboard');
      } else {
        alert(data.message || "이메일 또는 비밀번호를 확인해주세요.");
      }
    } catch (err) {
      console.error("로그인 에러:", err);
      alert("서버 연결에 실패했습니다.");
    }
  };

  const handleSocialLogin = (provider) => {
    window.location.href = `http://localhost:3000/auth/${provider}`;
  };

  return (
    <AuthLayout title="로그인" subtitle="다시 오신 것을 환영합니다!">
      <form className="flex flex-col gap-5 mt-8" onSubmit={handleLogin}>
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">이메일 계정</label>
          <input type="email" name="email" placeholder="your@email.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium" required />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">비밀번호</label>
          <input type="password" name="pwd" placeholder="비밀번호 입력" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium" required />
        </div>
        
        <button type="submit" className="w-full py-4 bg-[#5B44F2] text-white rounded-xl font-black mt-2 shadow-lg hover:bg-[#4a36c4] transition-all">
          로그인
        </button>
      </form>

      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 h-px bg-slate-200"></div>
        <span className="text-xs text-slate-400 font-bold">또는 소셜 계정으로 로그인</span>
        <div className="flex-1 h-px bg-slate-200"></div>
      </div>

      <div className="flex flex-col gap-3">
        <button onClick={() => handleSocialLogin('google')} className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
          구글 계정으로 로그인
        </button>
        <button onClick={() => handleSocialLogin('kakao')} className="w-full py-3.5 bg-[#FEE500] text-[#000000] rounded-xl font-bold text-sm hover:brightness-95 transition-all flex items-center justify-center gap-2">
          <img src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" alt="Kakao" className="w-5 h-5" />
          카카오 로그인
        </button>
        <button onClick={() => handleSocialLogin('naver')} className="w-full py-3.5 bg-[#03C75A] text-white rounded-xl font-bold text-sm hover:brightness-95 transition-all flex items-center justify-center gap-2">
          <span className="font-black text-lg">N</span>
          네이버 로그인
        </button>
      </div>

      <div className="text-center mt-6">
        <span className="text-slate-500 font-medium text-sm">아직 계정이 없으신가요? </span>
        <span onClick={() => onNavigate('signup')} className="text-[#5B44F2] font-bold text-sm cursor-pointer hover:underline">회원가입하기</span>
      </div>
    </AuthLayout>
  );
}