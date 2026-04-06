import { apiClient } from './base';

/**
 * 실시간 집중 세션 제어 및 데이터 조회 API
 */
export const immersionApi = {
  start: (user_idx) => apiClient.post('/api/immersion/start', { user_idx }),
  end: (data) => apiClient.post('/api/immersion/end', data),
  getReportDetail: (imm_idx) => apiClient.get(`/api/immersion/report/${imm_idx}`),
  getHistory: (user_idx) => apiClient.get(`/api/mypage/history/${user_idx}`),
  getStats: (user_idx) => apiClient.get(`/api/mypage/stats/${user_idx}`),
  
  // 뱃지 상점 수동 구매(차감) API 연동
  purchaseBadge: (user_idx, badge_id) => apiClient.post('/api/mypage/badge/purchase', { user_idx, badge_id }),
};