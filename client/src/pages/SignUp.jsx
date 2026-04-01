import React, { useState } from 'react';
import { authApi } from '../shared/api';
import AuthLayout from '../widgets/AuthLayout';

/**
 * 신규 사용자 회원가입 및 이메일 인증을 담당하는 페이지 컴포넌트
 */
export default function SignUp({ onNavigate, setIsLoggedIn }) {
  const [nick, setNick] = useState('');
  const [email, setEmail] = useState('');
  const [isNickChecked, setIsNickChecked] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [authCode, setAuthCode] = useState('');

  const handleNickCheck = async () => {
    if (!nick) return alert("닉네임을 입력해주세요.");
    try {
      const data = await authApi.checkNickname(nick);
      if (data && data.success) {
        alert("사용 가능한 닉네임입니다.");
        setIsNickChecked(true);
      } else {
        alert(data?.message || "이미 사용 중인 닉네임입니다.");
        setIsNickChecked(false);
      }
    } catch (err) {
      alert("닉네임 확인 중 오류가 발생했습니다.");
    }
  };

  const handleSendEmail = async () => {
    if (!email) return alert("이메일을 입력해주세요.");
    try {
      const data = await authApi.sendEmailCode(email);
      if (data && data.success) {
        alert("인증 코드가 발송되었습니다. 이메일을 확인해주세요.");
        setIsEmailSent(true);
      } else {
        alert(data?.message || "이메일 발송에 실패했습니다.");
      }
    } catch (err) {
      alert("이메일 발송 중 오류가 발생했습니다.");
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode) return alert("인증 코드를 입력해주세요.");
    try {
      const data = await authApi.verifyEmailCode(email, authCode);
      if (data && data.success) {
        alert("이메일 인증이 완료되었습니다.");
        setIsVerified(true);
      } else {
        alert(data?.message || "인증 코드가 일치하지 않습니다.");
      }
    } catch (err) {
      alert("인증 확인 중 오류가 발생했습니다.");
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!isNickChecked) return alert("닉네임 중복 확인을 해주세요.");
    if (!isVerified) return alert("이메일 인증을 완료해주세요.");

    const pwd = e.target.pwd.value;
    const pwdConfirm = e.target.pwdConfirm.value;

    if (pwd !== pwdConfirm) return alert("비밀번호가 일치하지 않습니다.");

    try {
      const data = await authApi.signUp({ nick, email, pwd });
      
      if (data && data.success) {
        alert("회원가입 완료! 자동으로 로그인합니다.");
        
        /* 회원가입 직후 자동 로그인 실행 */
        const loginData = await authApi.login({ email, pwd });
        
        /* 백엔드 shared 규격 동기화: 자동 로그인 시 data.data.user 파싱 적용 */
        if (loginData && loginData.success && loginData.data?.user) {
          localStorage.setItem('user_info', JSON.stringify(loginData.data.user));
          setIsLoggedIn(true);
          onNavigate('dashboard');
        } else {
          onNavigate('login');
        }
      } else {
        alert(data?.message || "회원가입 처리에 실패했습니다.");
      }
    } catch (err) {
      console.error("SignUp Error:", err.message);
      alert("회원가입 중 서버 오류가 발생했습니다.");
    }
  };

  /* UI 렌더링 영역 유지 */
  return (
    <AuthLayout title="회원가입" subtitle="포커스 러너가 되어주세요!">
      <form className="flex flex-col gap-4 mt-8" onSubmit={handleSignUp}>
        
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">닉네임</label>
          <div className="flex gap-2">
            <input type="text" value={nick} onChange={(e) => { setNick(e.target.value); setIsNickChecked(false); }} placeholder="닉네임 입력" className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium" required />
            <button type="button" onClick={handleNickCheck} className={`px-5 py-3.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${isNickChecked ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
              {isNickChecked ? '확인 완료' : '중복 확인'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">이메일 인증</label>
          <div className="flex gap-2 mb-2">
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setIsEmailSent(false); setIsVerified(false); }} disabled={isVerified} placeholder="your@email.com" className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium disabled:opacity-50" required />
            <button type="button" onClick={handleSendEmail} disabled={isVerified} className="px-5 py-3.5 bg-slate-800 text-white rounded-xl font-bold text-sm whitespace-nowrap hover:bg-slate-700 transition-all disabled:opacity-50">
              {isEmailSent ? '재발송' : '코드 발송'}
            </button>
          </div>
          
          {isEmailSent && !isVerified && (
            <div className="flex gap-2 animate-fade-in">
              <input type="text" value={authCode} onChange={(e) => setAuthCode(e.target.value)} placeholder="인증 코드 6자리" className="flex-1 px-5 py-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium" required />
              <button type="button" onClick={handleVerifyCode} className="px-5 py-3.5 bg-[#5B44F2] text-white rounded-xl font-bold text-sm whitespace-nowrap hover:bg-[#4a36c4] transition-all shadow-md shadow-indigo-200">
                인증 확인
              </button>
            </div>
          )}
          {isVerified && <p className="text-emerald-500 text-sm font-bold px-1 flex items-center gap-1">✓ 이메일 인증이 완료되었습니다.</p>}
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">비밀번호</label>
          <input type="password" name="pwd" placeholder="비밀번호 (8자 이상)" minLength="8" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium" required />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">비밀번호 확인</label>
          <input type="password" name="pwdConfirm" placeholder="비밀번호 다시 입력" minLength="8" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium" required />
        </div>
        
        <button type="submit" className="w-full py-4 bg-[#5B44F2] text-white rounded-xl font-black mt-4 shadow-lg hover:bg-[#4a36c4] transition-all active:scale-[0.98]">
          가입하기
        </button>
      </form>

      <div className="text-center mt-6">
        <span className="text-slate-500 font-medium text-sm">이미 계정이 있으신가요? </span>
        <span onClick={() => onNavigate('login')} className="text-[#5B44F2] font-bold text-sm cursor-pointer hover:underline">로그인하기</span>
      </div>
    </AuthLayout>
  );
}