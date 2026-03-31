import React, { useState, useRef, useEffect } from 'react';
import AuthLayout from '../components/AuthLayout';

export default function SignUp({ onNavigate, setIsLoggedIn }) {
  // 닉네임 상태 관리
  const [nick, setNick] = useState('');
  const [isNickChecked, setIsNickChecked] = useState(false); // 닉네임 중복 확인 여부

  // 이메일 상태 관리
  const [email, setEmail] = useState('');
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  const emailRef = useRef(null); // 이메일 자동완성 드롭다운 외부 클릭 감지용
  const emailDomains = ['gmail.com', 'naver.com', 'daum.net', 'kakao.com'];

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emailRef.current && !emailRef.current.contains(event.target)) {
        setShowEmailSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. 닉네임 변경 핸들러 (수정 시 중복 확인 초기화)
  const handleNickChange = (e) => {
    setNick(e.target.value);
    setIsNickChecked(false); 
  };

  // 2. 닉네임 중복 확인 API
  const handleCheckNick = async () => {
    if (!nick.trim()) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    try {
      // TODO: 백엔드 닉네임 중복 체크 API 연결
      const res = await fetch('http://localhost:3000/auth/check-nick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick })
      });
      const data = await res.json();

      if (data.success) {
        alert("사용 가능한 닉네임입니다.");
        setIsNickChecked(true);
      } else {
        alert(data.message || "이미 사용 중인 닉네임입니다.");
        setIsNickChecked(false);
      }
    } catch (err) {
      console.error("닉네임 중복 체크 에러:", err);
      // 백엔드 API가 아직 없을 때 임시 통과를 원하면 아래 주석 해제
      // alert("[임시] 사용 가능한 닉네임입니다. (API 미연동)");
      // setIsNickChecked(true);
      alert("서버 통신 오류가 발생했습니다.");
    }
  };

  // 3. 이메일 입력 및 자동완성 핸들러
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    // '@'가 포함되어 있고 아직 도메인이 완성되지 않았을 때 드롭다운 표시
    if (value.includes('@')) {
      const [, domainPart] = value.split('@');
      if (!emailDomains.includes(domainPart)) {
        setShowEmailSuggestions(true);
      } else {
        setShowEmailSuggestions(false);
      }
    } else {
      setShowEmailSuggestions(false);
    }
  };

  // 자동완성 도메인 클릭 적용
  const selectEmailDomain = (domain) => {
    const [idPart] = email.split('@');
    setEmail(`${idPart}@${domain}`);
    setShowEmailSuggestions(false);
  };

  // 4. 이메일 인증번호 발송 API
  const handleSendCode = async () => {
    if (!email.includes('@') || !email.includes('.')) {
      alert("올바른 이메일 형식을 입력해 주세요.");
      return;
    }
    
    try {
      const res = await fetch('http://localhost:3000/auth/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (data.success) {
        alert("인증번호가 발송되었습니다. 이메일을 확인해 주세요.");
        setIsCodeSent(true);
      } else {
        alert(data.message || "발송에 실패했습니다.");
      }
    } catch (err) {
      console.error("이메일 발송 에러:", err);
      alert("서버 통신 오류가 발생했습니다.");
    }
  };

  // 5. 이메일 인증번호 검증 API
  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    
    try {
      const res = await fetch('http://localhost:3000/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });
      const data = await res.json();

      if (data.success) {
        alert("이메일 인증이 완료되었습니다.");
        setIsVerified(true);
      } else {
        alert("인증번호가 일치하지 않습니다.");
      }
    } catch (err) {
      console.error("인증번호 검증 에러:", err);
      alert("서버 통신 오류가 발생했습니다.");
    }
  };

  // 6. 최종 회원가입 진행
  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (!isNickChecked) {
      alert("닉네임 중복 확인을 진행해주세요.");
      return;
    }
    if (!isVerified) {
      alert("이메일 인증을 완료해주세요.");
      return;
    }

    const pwd = e.target.pwd.value;

    try {
      const res = await fetch('http://localhost:3000/user/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick, email, pwd })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        alert("회원가입 완료! 자동으로 로그인합니다.");
        
        // 가입 성공 시 자동 로그인 연동
        const loginRes = await fetch('http://localhost:3000/user/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', 
          body: JSON.stringify({ email, pwd })
        });
        const loginData = await loginRes.json();
        
        if (loginData.success) {
          if (loginData.user_info) {
            localStorage.setItem('user_info', JSON.stringify(loginData.user_info));
          }
          setIsLoggedIn(true); 
          onNavigate('dashboard'); 
        }
      } else {
        alert(data.message || "회원가입에 실패했습니다.");
      }
    } catch (err) {
      console.error("회원가입 에러:", err);
      alert("서버 연결에 실패했습니다.");
    }
  };

  return (
    <AuthLayout title="회원가입" subtitle="스마트 포커스와 함께 집중력을 높여보세요!">
      <form className="flex flex-col gap-5 mt-8" onSubmit={handleSignUp}>
        
        {/* 닉네임 입력 및 중복 확인 영역 */}
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">닉네임</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              name="nick" 
              value={nick}
              onChange={handleNickChange}
              placeholder="사용하실 닉네임을 입력해주세요" 
              className="flex-1 px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium placeholder:text-slate-400" 
              required 
            />
            <button 
              type="button" 
              onClick={handleCheckNick} 
              className={`px-4 py-4 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                isNickChecked 
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed" 
                  : "bg-slate-800 text-white hover:bg-slate-700"
              }`}
            >
              {isNickChecked ? '확인완료' : '중복확인'}
            </button>
          </div>
        </div>
        
        {/* 이메일 입력, 자동완성 드롭다운, 인증 발송 영역 */}
        <div ref={emailRef} className="relative">
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">이메일 계정</label>
          <div className="flex gap-2">
            <input 
              type="email" 
              value={email} 
              onChange={handleEmailChange} 
              placeholder="이메일 주소를 입력해주세요" 
              className="flex-1 px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium placeholder:text-slate-400" 
              disabled={isVerified}
              autoComplete="off"
              required 
            />
            <button 
              type="button" 
              onClick={handleSendCode} 
              disabled={isVerified} 
              className={`px-4 py-4 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                isVerified 
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed" 
                  : "bg-slate-800 text-white hover:bg-slate-700"
              }`}
            >
              {isVerified ? '인증완료' : '인증발송'}
            </button>
          </div>

          {/* 자동완성 드롭다운 UI */}
          {showEmailSuggestions && !isVerified && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-fade-in">
              {emailDomains.map((domain) => (
                <div 
                  key={domain} 
                  onClick={() => selectEmailDomain(domain)}
                  className="px-5 py-3 cursor-pointer hover:bg-indigo-50 text-sm font-medium text-slate-600 transition-colors"
                >
                  {email.split('@')[0]}@{domain}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 인증번호 입력 영역 (발송 버튼 누른 후 노출) */}
        {isCodeSent && !isVerified && (
          <div className="flex gap-2 animate-fade-in">
            <input 
              type="text" 
              value={verificationCode} 
              onChange={(e) => setVerificationCode(e.target.value)} 
              placeholder="인증번호 6자리를 입력해주세요" 
              className="flex-1 px-5 py-4 bg-indigo-50 border border-indigo-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium placeholder:text-indigo-300" 
            />
            <button 
              type="button" 
              onClick={handleVerifyCode} 
              className="px-4 py-4 bg-[#5B44F2] text-white rounded-xl font-bold text-sm whitespace-nowrap hover:bg-[#4a36c4]"
            >
              확인
            </button>
          </div>
        )}

        {/* 비밀번호 입력 영역 */}
        <div>
          <label className="text-sm font-bold text-slate-700 block px-1 mb-2">비밀번호</label>
          <input 
            type="password" 
            name="pwd" 
            placeholder="영문, 숫자 포함 8자리 이상" 
            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-[#5B44F2] transition-all font-medium placeholder:text-slate-400" 
            required 
          />
        </div>

        {/* 가입 완료 버튼 (닉네임 중복확인 및 이메일 인증 통과 시 활성화) */}
        <button 
          type="submit" 
          disabled={!isNickChecked || !isVerified} 
          className="w-full py-4 bg-[#5B44F2] text-white rounded-xl font-black mt-2 shadow-lg hover:bg-[#4a36c4] disabled:bg-slate-300 disabled:shadow-none transition-all"
        >
          회원가입 완료
        </button>
        
        <div className="text-center mt-4">
          <span className="text-slate-500 font-medium text-sm">이미 계정이 있으신가요? </span>
          <span onClick={() => onNavigate('login')} className="text-[#5B44F2] font-bold text-sm cursor-pointer hover:underline">로그인하기</span>
        </div>
      </form>
    </AuthLayout>
  );
}