import { apiClient } from './base';

/**
 * 사용자 인증 및 계정 관련 API 호출 모음
 * 백엔드 shared 응답 규격 및 세션 엔드포인트 수정을 반영함
 */
export const authApi = {
  /**
   * 세션 유효성 확인 및 사용자 정보 조회
   * 백엔드 요청에 따라 엔드포인트를 /auth/session으로 변경함
   */
  checkSession: () => apiClient.get('/auth/session'),
  
  /**
   * 로그인 요청
   */
  login: (credentials) => apiClient.post('/user/login', credentials),
  
  /**
   * 로그아웃 요청
   */
  logout: () => apiClient.post('/user/logout'),

  /**
   * 닉네임 중복 체크
   */
  checkNickname: (nick) => apiClient.post('/auth/check-nick', { nick }),

  /**
   * 이메일 인증코드 발송
   */
  sendEmailCode: (email) => apiClient.post('/auth/send-email', { email }),

  /**
   * 이메일 인증코드 검증
   */
  verifyEmailCode: (email, code) => apiClient.post('/auth/verify-code', { email, code }),

  /**
   * 회원가입 요청
   */
  signUp: (userData) => apiClient.post('/user/join', userData),
};