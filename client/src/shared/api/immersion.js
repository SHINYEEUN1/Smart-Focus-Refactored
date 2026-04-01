import { apiClient } from './base';

/**
 * 실시간 몰입 세션 제어 및 데이터 조회 관련 API 호출 모음
 */
export const immersionApi = {
  /**
   * 새로운 몰입 세션 시작 요청
   */
  start: (user_idx) => apiClient.post('/api/immersion/start', { user_idx }),

  /**
   * 진행 중인 몰입 세션 종료 및 결과 저장
   */
  end: (data) => apiClient.post('/api/immersion/end', data),

  /**
   * 특정 세션의 상세 분석 리포트 데이터 조회
   */
  getReportDetail: (imm_idx) => apiClient.get(`/api/immersion/report/${imm_idx}`),

  /**
   * 사용자의 전체 몰입 기록 히스토리 조회
   */
  getHistory: (user_idx) => apiClient.get(`/api/mypage/history/${user_idx}`),

  /**
   * 사용자의 누적 통계 데이터 조회
   */
  getStats: (user_idx) => apiClient.get(`/api/mypage/stats/${user_idx}`),
};