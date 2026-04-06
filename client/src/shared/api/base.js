/**
 * 전역 API 통신을 담당하는 기본 클라이언트
 * - 운영 서버와 로컬 환경을 VITE_API_URL 변수로 자동 분리함
 * - 세션 유지를 위한 credentials 설정을 기본으로 포함
 */
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = {
  get: async (url) => {
    const response = await fetch(`${BASE_URL}${url}`, { 
      method: 'GET', 
      credentials: 'include' 
    });
    return response.json();
  },
  
  post: async (url, body) => {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
  }
};