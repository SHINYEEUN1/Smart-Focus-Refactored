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
        
        // 2. 가입 성공 후 즉시 자동 로그인 시도
        const loginRes = await fetch('http://localhost:3000/user/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', 
          body: JSON.stringify({ email, pwd })
        });
        const loginData = await loginRes.json();
        
        if (loginData.success) {
          // 회원가입 후 자동 로그인 시에도 유저 정보를 로컬스토리지에 저장 (닉네임 데이터 누락 방지)
          if (loginData.user_info) {
            localStorage.setItem('user_info', JSON.stringify(loginData.user_info));
          }
          setIsLoggedIn(true); 
          onNavigate('/dashboard'); 
        } else {
          alert('자동 로그인에 실패했습니다. 직접 로그인해주세요.');
          onNavigate('/login');
        }
      } else {
        alert(data.message || "회원가입에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 연결에 실패했습니다.");
    }
  };

  return (
    <AuthLayout title="회원가입" subtitle="스마트 포커스와 함께 집중력을 높여보세요!">
      <form className="flex flex-col gap-5 mt-8" onSubmit={handleSignUp}>
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">닉네임</label>
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
        <button type="submit" className="w-full py-4 bg-[#5B44F2] text-white rounded-xl font-black mt-2 shadow-lg shadow-[#5B44F2]/20 hover:bg-[#4a36c4] hover:shadow-[#5B44F2]/30 hover:-translate-y-0.5 transition-all active:scale-95">
          회원가입 완료
        </button>
        <div className="text-center mt-4">
          <span className="text-slate-500 font-medium text-sm">이미 계정이 있으신가요? </span>
          <span onClick={() => onNavigate('/login')} className="text-[#5B44F2] font-bold text-sm cursor-pointer hover:underline">로그인하기</span>
        </div>
      </form>
    </AuthLayout>
  );
}