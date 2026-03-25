import React from 'react';
import AuthLayout from '../components/AuthLayout';

export default function SignUp({ onNavigate, setIsLoggedIn }) {
  const handleSignUp = async (e) => {
    e.preventDefault();
    const nick = e.target.nick.value;
    const email = e.target.email.value;
    const pwd = e.target.pwd.value;

    try {
      // 1. 회원가입 요청
      const res = await fetch('http://localhost:3000/user/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick, email, pwd })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        alert("회원가입이 완료되었습니다! 자동으로 로그인합니다. 🎉");
        
        // ✨ [핵심 수정] 가입 성공 후 즉시 로그인을 시도합니다.
        const loginRes = await fetch('http://localhost:3000/user/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // 세션 쿠키 발급을 위해 필요
          body: JSON.stringify({ email, pwd })
        });
        const loginData = await loginRes.json();
        
        if (loginData.success) {
          setIsLoggedIn(true); // 로그인 상태 스위치 켜기
          onNavigate('dashboard'); // 대시보드로 즉시 이동
        } else {
          // 혹시라도 자동 로그인이 실패하면 로그인 페이지로 안내
          onNavigate('login');
        }
      } else {
        alert(data.message || '회원가입 실패. 다시 시도해주세요.');
      }
    } catch (err) {
      console.error(err);
      alert('서버 연결에 실패했습니다.');
    }
  };

  return (
    <AuthLayout title="몰입의 시작, 스마트 포커스" subtitle="간단한 정보 입력으로 생산성을 높이세요.">
      <form className="space-y-5" onSubmit={handleSignUp}>
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">이름 (닉네임)</label>
          <input type="text" name="nick" placeholder="홍길동" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] focus:ring-4 focus:ring-[#5B44F2]/10 transition-all font-medium" required />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">이메일 계정</label>
          <input type="email" name="email" placeholder="your@email.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] focus:ring-4 focus:ring-[#5B44F2]/10 transition-all font-medium" required />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">비밀번호</label>
          <input type="password" name="pwd" placeholder="4자리 이상 영문/숫자" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] focus:ring-4 focus:ring-[#5B44F2]/10 transition-all font-medium" required />
        </div>
        <button type="submit" className="w-full py-4 bg-[#5B44F2] text-white rounded-xl font-black mt-2 shadow-lg shadow-[#5B44F2]/20 hover:-translate-y-0.5 hover:bg-[#4a36c4] transition-all text-lg">
          가입 완료하기
        </button>
      </form>
      <p className="mt-8 text-center text-sm text-slate-500 font-bold">
        이미 회원이신가요? <button type="button" onClick={() => onNavigate('login')} className="text-[#5B44F2] hover:underline ml-1">로그인하기</button>
      </p>
    </AuthLayout>
  );
}