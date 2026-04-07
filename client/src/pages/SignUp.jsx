import React, { useState, useRef, useEffect } from 'react';
import { authApi } from '../shared/api';

/**
 * [회원가입 페이지]
 * - [UX 개선] 이메일 도메인 자동완성 드롭다운 (키보드 방향키 및 Enter 선택 지원)
 * - [UI 개선] 인증 번호 입력창 렌더링 시 발생하는 Layout Shift 방지
 * - [Bug Fix] 이메일 발송 비동기 로딩 스피너 및 이미 가입된 이메일 예외 처리
 */
const EMAIL_DOMAINS = ['gmail.com', 'naver.com', 'kakao.com', 'daum.net', 'hanmail.net'];

export default function SignUp({ onNavigate, setIsLoggedIn }) {
  const [nick, setNick] = useState('');
  const [email, setEmail] = useState('');
  const [isNickChecked, setIsNickChecked] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [authCode, setAuthCode] = useState('');
  
  const [isEmailSending, setIsEmailSending] = useState(false);
  
  /* 이메일 자동완성 상태 및 키보드 네비게이션 관리 */
  const [showDomainDropdown, setShowDomainDropdown] = useState(false);
  const [filteredDomains, setFilteredDomains] = useState(EMAIL_DOMAINS);
  const [focusedDomainIndex, setFocusedDomainIndex] = useState(-1);
  const emailInputRef = useRef(null);
  const dropdownRef = useRef(null);

  /* 이메일 입력 감지 및 도메인 필터링 로직 */
  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    
    if (val.includes('@')) {
      const [, domainPart] = val.split('@');
      const filtered = EMAIL_DOMAINS.filter(d => d.startsWith(domainPart));
      setFilteredDomains(filtered);
      setShowDomainDropdown(filtered.length > 0 && !isVerified);
      setFocusedDomainIndex(-1); // 입력이 바뀌면 포커스 인덱스 초기화
    } else {
      setShowDomainDropdown(false);
    }
  };

  /* 키보드 방향키 제어 로직 */
  const handleEmailKeyDown = (e) => {
    if (!showDomainDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedDomainIndex((prev) => (prev < filteredDomains.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedDomainIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && focusedDomainIndex >= 0) {
      e.preventDefault();
      handleDomainSelect(filteredDomains[focusedDomainIndex]);
    } else if (e.key === 'Escape') {
      setShowDomainDropdown(false);
    }
  };

  /* 추천 도메인 클릭 시 이메일 완성 */
  const handleDomainSelect = (domain) => {
    const [idPart] = email.split('@');
    setEmail(`${idPart}@${domain}`);
    setShowDomainDropdown(false);
    setFocusedDomainIndex(-1);
    emailInputRef.current?.focus(); 
  };

  /* 외부 클릭 시 드롭다운 닫기 처리를 위한 보완 (onBlur 지연보다 안정적) */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && emailInputRef.current !== e.target) {
        setShowDomainDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    if (!email || !email.includes('@')) return alert("유효한 이메일을 입력해주세요.");
    
    setIsEmailSending(true);
    try {
      const data = await authApi.sendEmailCode(email);
      if (data && data.success) {
        alert("인증 코드를 발송했습니다. 메일함을 확인해주세요!");
        setIsEmailSent(true);
        setShowDomainDropdown(false);
      } else {
        alert(data?.message || "이미 가입된 이메일이거나 발송에 실패했습니다.");
      }
    } catch (err) { 
      alert("이메일 발송 중 서버 오류가 발생했습니다."); 
    } finally {
      setIsEmailSending(false); 
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode) return alert("인증 코드를 입력해주세요.");
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
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-transparent p-6 font-sans transition-colors duration-300">
      <div className="w-full max-w-[500px] bg-white dark:bg-slate-900/80 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-10 md:p-12 animate-fade-in backdrop-blur-md transition-all">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter transition-colors">회원가입</h1>
        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-8 px-1">포커스 러너의 여정을 시작해보세요.</p>

        <form className="space-y-6" onSubmit={handleSignUp}>
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest block mb-2 px-1">닉네임</label>
            <div className="flex gap-2">
              <input type="text" value={nick} onChange={(e) => { setNick(e.target.value); setIsNickChecked(false); }} className="flex-1 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-[#5B44F2] dark:focus:border-indigo-400 transition-all font-bold text-sm text-slate-900 dark:text-white" placeholder="닉네임 입력" required />
              <button type="button" onClick={handleNickCheck} className={`px-4 py-3.5 rounded-xl font-black text-xs transition-all ${isNickChecked ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50' : 'bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600'}`}>{isNickChecked ? '체크완료' : '중복확인'}</button>
            </div>
          </div>

          {/* 이메일 입력 구역 */}
          <div className="relative">
            <label className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest block mb-2 px-1">이메일 인증</label>
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <input 
                  ref={emailInputRef}
                  type="email" 
                  name="email"
                  autoComplete="email"
                  value={email} 
                  disabled={isVerified || isEmailSending} 
                  onChange={handleEmailChange}
                  onKeyDown={handleEmailKeyDown} // 키보드 조작 이벤트 연동
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-[#5B44F2] dark:focus:border-indigo-400 transition-all font-bold text-sm disabled:opacity-50 text-slate-900 dark:text-white" 
                  placeholder="your@email.com" 
                  required 
                />
                
                {/* 도메인 추천 드롭다운 (키보드 하이라이트 UI 반영) */}
                {showDomainDropdown && (
                  <ul ref={dropdownRef} className="absolute left-0 right-0 top-[110%] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                    {filteredDomains.map((domain, index) => (
                      <li 
                        key={domain} 
                        onClick={() => handleDomainSelect(domain)}
                        className={`px-5 py-3 text-sm font-bold cursor-pointer transition-colors ${
                          index === focusedDomainIndex 
                            ? 'bg-[#5B44F2]/10 dark:bg-indigo-500/20 text-[#5B44F2] dark:text-indigo-300 border-l-4 border-[#5B44F2]' 
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-transparent'
                        }`}
                      >
                        {email.split('@')[0]}<span className={index === focusedDomainIndex ? 'font-black' : 'text-[#5B44F2] dark:text-indigo-400'}>@{domain}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <button type="button" onClick={handleSendEmail} disabled={isVerified || isEmailSending} className="w-24 px-4 py-3.5 bg-slate-800 text-white rounded-xl font-black text-xs hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition-all disabled:opacity-50 flex items-center justify-center">
                {isEmailSending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '코드발송'}
              </button>
            </div>

            <div className={`flex gap-2 transition-all duration-300 ${isEmailSent ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <input type="text" value={authCode} onChange={(e) => setAuthCode(e.target.value)} disabled={!isEmailSent || isVerified} className="flex-1 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-[#5B44F2] dark:focus:border-indigo-400 transition-all font-bold text-sm text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-900" placeholder="인증코드 6자리" maxLength="6" />
              <button type="button" onClick={handleVerifyCode} disabled={!isEmailSent || isVerified} className="px-4 py-3.5 bg-[#5B44F2] text-white rounded-xl font-black text-xs shadow-md hover:bg-[#4a36c4] transition-all disabled:opacity-50 disabled:shadow-none">확인</button>
            </div>
            {isVerified && <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold px-1 mt-2 transition-colors animate-fade-in">✓ 이메일 인증이 완료되었습니다.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest block mb-2 px-1">비밀번호</label>
              <input type="password" name="pwd" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-[#5B44F2] dark:focus:border-indigo-400 font-bold text-sm text-slate-900 dark:text-white transition-all" placeholder="8자 이상" minLength="8" required />
            </div>
            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest block mb-2 px-1">비밀번호 확인</label>
              <input type="password" name="pwdConfirm" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-[#5B44F2] dark:focus:border-indigo-400 font-bold text-sm text-slate-900 dark:text-white transition-all" placeholder="다시 입력" required />
            </div>
          </div>

          <button type="submit" className="w-full py-4 bg-[#5B44F2] text-white rounded-2xl font-black text-base shadow-lg hover:bg-[#4a36c4] active:scale-[0.98] transition-all mt-6">포커스 러너 가입하기</button>
        </form>
        <button onClick={() => onNavigate('login')} className="w-full mt-8 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-[#5B44F2] dark:hover:text-indigo-400 transition-colors underline underline-offset-4">이미 계정이 있으신가요? 로그인</button>
      </div>
    </div>
  );
}