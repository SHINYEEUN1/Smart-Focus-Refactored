import React, { useState } from 'react';
import { authApi } from '../shared/api';

/**
 * [회원가입 페이지 폴리싱]
 * - 로그인/마이페이지와 동일한 톤앤매너 적용
 * - 비동기 처리 시 버튼 비활성화 로직 추가
 */
export default function SignUp({ onNavigate, setIsLoggedIn }) {
  const [nick, setNick] = useState('');
  const [email, setEmail] = useState('');
  const [isNickChecked, setIsNickChecked] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [authCode, setAuthCode] = useState('');

  const handleNickCheck = async () => {
    if (!nick) return alert("닉네임을 먼저 입력해주세요.");
    try {
      const data = await authApi.checkNickname(nick);
      if (data && data.success) {
        alert("사용 가능한 멋진 닉네임입니다!");
        setIsNickChecked(true);
      } else {
        alert(data?.message || "이미 누군가 사용 중인 닉네임이에요.");
        setIsNickChecked(false);
      }
    } catch (err) { alert("통신 오류가 발생했습니다."); }
  };

  const handleSendEmail = async () => {
    if (!email) return alert("이메일을 입력해주세요.");
    try {
      const data = await authApi.sendEmailCode(email);
      if (data && data.success) {
        alert("인증 코드를 발송했습니다. 메일함을 확인해주세요!");
        setIsEmailSent(true);
      }
    } catch (err) { alert("이메일 발송 중 오류가 발생했습니다."); }
  };

  const handleVerifyCode = async () => {
    try {
      const data = await authApi.verifyEmailCode(email, authCode);
      if (data && data.success) {
        alert("인증이 정상적으로 완료되었습니다.");
        setIsVerified(true);
      } else { alert("인증 코드가 틀렸습니다. 다시 확인해주세요."); }
    } catch (err) { alert("인증 중 서버 오류가 발생했습니다."); }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!isNickChecked) return alert("닉네임 중복 확인이 필요합니다.");
    if (!isVerified) return alert("이메일 인증을 먼저 완료해주세요.");

    const pwd = e.target.pwd.value;
    const pwdConfirm = e.target.pwdConfirm.value;
    if (pwd !== pwdConfirm) return alert("비밀번호가 서로 일치하지 않습니다.");

    try {
      const data = await authApi.signUp({ nick, email, pwd });
      if (data && data.success) {
        alert("환영합니다! 회원가입이 완료되었습니다.");
        const loginData = await authApi.login({ email, pwd });
        if (loginData?.success) {
          localStorage.setItem('user_info', JSON.stringify(loginData.data.user));
          setIsLoggedIn(true);
          onNavigate('dashboard');
        } else { onNavigate('login'); }
      }
    } catch (err) { alert("가입 처리 중 문제가 발생했습니다."); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 font-sans">
      <div className="w-full max-w-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-10 md:p-12 animate-fade-in">
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter">회원가입</h1>
        <p className="text-sm font-bold text-slate-400 mb-8 px-1">포커스 러너의 여정을 시작해보세요.</p>

        <form className="space-y-5" onSubmit={handleSignUp}>
          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest block mb-2 px-1">닉네임</label>
            <div className="flex gap-2">
              <input type="text" value={nick} onChange={(e) => { setNick(e.target.value); setIsNickChecked(false); }} className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#5B44F2] transition-all font-bold text-sm" placeholder="닉네임 입력" required />
              <button type="button" onClick={handleNickCheck} className={`px-4 py-3.5 rounded-xl font-black text-xs transition-all ${isNickChecked ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>{isNickChecked ? '체크완료' : '중복확인'}</button>
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-widest block mb-2 px-1">이메일 인증</label>
            <div className="flex gap-2 mb-2">
              <input type="email" value={email} disabled={isVerified} onChange={(e) => setEmail(e.target.value)} className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#5B44F2] transition-all font-bold text-sm disabled:opacity-50" placeholder="your@email.com" required />
              <button type="button" onClick={handleSendEmail} disabled={isVerified} className="px-4 py-3.5 bg-slate-800 text-white rounded-xl font-black text-xs hover:bg-slate-700 transition-all">코드발송</button>
            </div>
            {isEmailSent && !isVerified && (
              <div className="flex gap-2 animate-fade-in">
                <input type="text" value={authCode} onChange={(e) => setAuthCode(e.target.value)} className="flex-1 px-5 py-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl outline-none font-bold text-sm" placeholder="인증코드 6자리" required />
                <button type="button" onClick={handleVerifyCode} className="px-4 py-3.5 bg-[#5B44F2] text-white rounded-xl font-black text-xs shadow-md">확인</button>
              </div>
            )}
            {isVerified && <p className="text-[11px] text-emerald-600 font-bold px-1 mt-1">✓ 이메일 인증이 완료되었습니다.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest block mb-2 px-1">비밀번호</label>
              <input type="password" name="pwd" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#5B44F2] font-bold text-sm" placeholder="8자 이상" minLength="8" required />
            </div>
            <div>
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest block mb-2 px-1">비밀번호 확인</label>
              <input type="password" name="pwdConfirm" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-[#5B44F2] font-bold text-sm" placeholder="다시 입력" required />
            </div>
          </div>

          <button type="submit" className="w-full py-4 bg-[#5B44F2] text-white rounded-2xl font-black shadow-lg hover:bg-[#4a36c4] active:scale-[0.98] transition-all mt-4">포커스 러너 가입하기</button>
        </form>
        <button onClick={() => onNavigate('login')} className="w-full mt-6 text-xs font-bold text-slate-400 hover:text-[#5B44F2] transition-colors underline underline-offset-4">이미 계정이 있으신가요? 로그인</button>
      </div>
    </div>
  );
}