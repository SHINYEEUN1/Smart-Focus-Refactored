import React from 'react';
import AuthLayout from '../components/AuthLayout';

// ✨ [핵심 수정] App.jsx에서 넘겨준 setIsLoggedIn을 받아옵니다.
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
        alert(data.message); 
        // ✨ [핵심 수정] 로그인에 성공했으니 상단 헤더 메뉴도 로그인 상태로 바꾸라고 명령합니다!
        setIsLoggedIn(true); 
        onNavigate('dashboard');
      } else {
        alert(data.message || '로그인에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버 연결에 실패했습니다. 백엔드 서버가 켜져 있는지 확인해주세요.');
    }
  };

  return (
    <AuthLayout title="다시 오신 것을 환영합니다!" subtitle="최고의 몰입을 위해 로그인해주세요.">
      <form className="space-y-5" onSubmit={handleLogin}>
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">이메일 주소</label>
          <input type="email" name="email" placeholder="example@email.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] focus:ring-4 focus:ring-[#5B44F2]/10 transition-all font-medium" required />
        </div>
        <div>
          <div className="flex justify-between items-center px-1 mb-2">
            <label className="text-sm font-bold text-slate-700">비밀번호</label>
            <span className="text-xs font-bold text-[#5B44F2] cursor-pointer hover:underline">비밀번호 찾기</span>
          </div>
          <input type="password" name="pwd" placeholder="••••••••" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] focus:ring-4 focus:ring-[#5B44F2]/10 transition-all font-medium" required />
        </div>
        <button type="submit" className="w-full py-4 bg-[#5B44F2] text-white rounded-xl font-black mt-2 shadow-lg shadow-[#5B44F2]/20 hover:-translate-y-0.5 hover:bg-[#4a36c4] transition-all text-lg">
          로그인
        </button>
      </form>
      <p className="mt-8 text-center text-sm text-slate-500 font-bold">
        계정이 없으신가요? <button type="button" onClick={() => onNavigate('signup')} className="text-[#5B44F2] hover:underline ml-1">회원가입</button>
      </p>
    </AuthLayout>
  );
}