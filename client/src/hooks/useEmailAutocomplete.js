import { useState, useRef, useEffect } from 'react';

// 이메일 입력 시 도메인 자동완성 기능을 제공하는 커스텀 훅.
// Login과 SignUp 두 페이지에서 동일한 로직이 중복되어 있어 하나의 훅으로 추출했다.
// 이유: 도메인 필터링, 키보드 네비게이션, 외부 클릭 감지 로직이 두 컴포넌트에 완전히 동일하게 존재했기 때문이다.
const EMAIL_DOMAINS = ['gmail.com', 'naver.com', 'kakao.com', 'daum.net', 'hanmail.net'];

/**
 * 이메일 자동완성 훅
 * @param {string} email - 현재 이메일 입력값 (상위 컴포넌트에서 관리)
 * @param {Function} setEmail - 이메일 상태 업데이트 함수
 * @param {boolean} [disabled=false] - 자동완성 비활성화 여부 (인증 완료 후 잠금 등)
 * @returns {{ showDomainDropdown, filteredDomains, focusedDomainIndex, emailInputRef, dropdownRef, handleEmailChange, handleEmailKeyDown, handleDomainSelect }}
 */
export function useEmailAutocomplete(email, setEmail, disabled = false) {
  const [showDomainDropdown, setShowDomainDropdown] = useState(false);
  const [filteredDomains, setFilteredDomains] = useState(EMAIL_DOMAINS);
  const [focusedDomainIndex, setFocusedDomainIndex] = useState(-1);
  const emailInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // 이메일 입력 시 '@' 뒤 도메인 부분으로 후보를 필터링한다.
  // disabled 상태(인증 완료)에서는 드롭다운을 열지 않는다.
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    if (value.includes('@') && !disabled) {
      const [, domainPart] = value.split('@');
      const filtered = EMAIL_DOMAINS.filter(d => d.startsWith(domainPart));
      setFilteredDomains(filtered);
      setShowDomainDropdown(filtered.length > 0);
      setFocusedDomainIndex(-1);
    } else {
      setShowDomainDropdown(false);
    }
  };

  // 키보드 방향키로 도메인 목록을 탐색하고, Enter로 선택, Escape로 닫는다.
  // onBlur 대신 keydown으로 처리하는 이유: onBlur는 클릭 이벤트보다 먼저 발생하여
  // 드롭다운 항목 클릭이 무시될 수 있기 때문이다.
  const handleEmailKeyDown = (e) => {
    if (!showDomainDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedDomainIndex(prev => (prev < filteredDomains.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedDomainIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && focusedDomainIndex >= 0) {
      e.preventDefault();
      handleDomainSelect(filteredDomains[focusedDomainIndex]);
    } else if (e.key === 'Escape') {
      setShowDomainDropdown(false);
    }
  };

  const handleDomainSelect = (domain) => {
    const [idPart] = email.split('@');
    setEmail(`${idPart}@${domain}`);
    setShowDomainDropdown(false);
    setFocusedDomainIndex(-1);
    emailInputRef.current?.focus();
  };

  // 드롭다운 외부 클릭 시 닫는 처리.
  // onBlur 대신 mousedown을 사용하는 이유: onBlur는 포커스 이동 시 즉시 발생해
  // 드롭다운 항목의 onClick이 실행되기 전에 목록이 사라지는 문제가 있기 때문이다.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        emailInputRef.current !== e.target
      ) {
        setShowDomainDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return {
    showDomainDropdown,
    filteredDomains,
    focusedDomainIndex,
    emailInputRef,
    dropdownRef,
    handleEmailChange,
    handleEmailKeyDown,
    handleDomainSelect,
  };
}
