/**
 * 전역 API 통신용 HTTP 클라이언트 인스턴스
 * Fetch API를 기반으로 작성되었으며, 공통 Base URL 및 인증 쿠키 포함 옵션을 기본 적용함
 */
export const apiClient = {
  get: async (url) => {
    const response = await fetch(`http://localhost:3000${url}`, { 
      method: 'GET', 
      credentials: 'include' 
    });
    return response.json();
  },
  
  post: async (url, body) => {
    const response = await fetch(`http://localhost:3000${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
  }
};