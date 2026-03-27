import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MyPage.css'; 

// --- 공통 SVG 아이콘 컴포넌트 ---
const UserIcon = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const TargetIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const MedalIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><polyline points="12 18 12 15 9 15"/></svg>;
const SettingsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const ListIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const RefreshIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>;

export default function MyPage() {
  const navigate = useNavigate();
  
  // 상태 관리: 로딩 및 API 조회 데이터 통합 관리
  const [isLoading, setIsLoading] = useState(true);
  const [pageData, setPageData] = useState({
    stats: null,
    history: [],
    recordedDays: [] // 캘린더 마킹용 날짜 배열
  });

  // 로컬에 저장된 유저 정보 파싱 (기본값 설정으로 에러 방지)
  const userInfo = JSON.parse(localStorage.getItem('user_info')) || { user_idx: 1, nick: '사용자', email: 'user@email.com' };

  // 엔진 커스텀 세팅 (로컬스토리지 연동)
  const [noiseThreshold, setNoiseThreshold] = useState(() => {
    const saved = localStorage.getItem('smart_focus_noise_db');
    return saved !== null ? Number(saved) : 60;
  });

  useEffect(() => {
    localStorage.setItem('smart_focus_noise_db', noiseThreshold);
  }, [noiseThreshold]);

  // DB 실데이터 Fetch (통계 & 히스토리 병렬 처리)
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const { user_idx } = userInfo;

        // Promise.all로 두 개의 엔드포인트를 동시에 찔러서 렌더링 지연 최소화
        const [statsRes, historyRes] = await Promise.all([
          fetch(`http://localhost:3000/api/mypage/stats/${user_idx}`, { credentials: 'include' }),
          fetch(`http://localhost:3000/api/mypage/history/${user_idx}`, { credentials: 'include' })
        ]);

        const statsResult = await statsRes.json();
        const historyResult = await historyRes.json();

        if (statsResult.success && historyResult.success) {
          const stats = statsResult.data;
          const history = historyResult.data;

          // 히스토리 날짜 데이터에서 캘린더 렌더링을 위한 '일(Day)'만 추출 후 중복 제거
          const days = [...new Set(history.map(item => {
            const dateObj = new Date(item.imm_date);
            return dateObj.getDate();
          }))];

          setPageData({
            stats,
            history,
            recordedDays: days
          });
        } else {
          console.error("데이터 페칭 실패:", statsResult.message || historyResult.message);
        }
      } catch (error) {
        console.error("API 연동 중 예외 발생:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // 캘린더 렌더링용 변수 세팅
  const todayDate = new Date().getDate(); 
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleCalibration = () => {
    alert("바른 자세 기준점을 초기화합니다. 3초간 정면을 응시해 주세요!");
  };

  // 데이터 조회 중 스켈레톤/스피너 UI
  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold tracking-widest animate-pulse">개인 기록을 불러오고 있습니다...</p>
      </div>
    );
  }

  // 구조 분해 할당으로 가독성 확보
  const { stats, history, recordedDays } = pageData;

  // 통계 기반 진척도 계산 (Max 100%)
  const avgScoreGoal = Math.min(100, Math.round(((stats?.avg_score || 0) / 90) * 100)); 
  const sessionGoal = Math.min(100, Math.round(((stats?.total_sessions || 0) / 10) * 100));

  return (
    <div className="premium-mypage-wrapper">
      <header className="premium-header">
        <h1 className="premium-title">마이 페이지</h1>
        <p className="premium-subtitle">개인 포커스 대시보드에서 성장을 확인하세요.</p>
      </header>

      <div className="grid-layout">
        
        {/* ================= 프로필 & 누적 포인트 ================= */}
        <div className="premium-card profile-card">
          <div className="profile-left">
            <div className="profile-avatar"><UserIcon /></div>
            <div>
              <span className="profile-tag">FOCUS RUNNER</span>
              <h2 className="profile-name">{userInfo.nick}님</h2>
              <p className="profile-desc">{userInfo.email}</p>
            </div>
          </div>
          <div className="points-wrapper">
            <div className="points-label">누적 포인트</div>
            <div className="points-value">{stats?.total_points?.toLocaleString() || 0}</div>
            <div className="points-change">총 {stats?.total_sessions || 0}번의 몰입 완료!</div>
          </div>
        </div>

        {/* ================= 캘린더 영역 ================= */}
        <div className="premium-card calendar-card">
          <div className="calendar-top-nav">
            <h3 className="calendar-month-title">{currentYear}년 {currentMonth}월의 몰입 기록</h3>
            <div>
              <button className="calendar-nav-btn" style={{ marginRight: '8px' }}>이전 달</button>
              <button className="calendar-nav-btn">다음 달</button>
            </div>
          </div>

          <div className="calendar-container">
            <div className="calendar-weekdays">
              <span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>
            </div>
            
            <div className="calendar-days-grid">
              {daysInMonth.map((day) => {
                const isRecorded = recordedDays.includes(day);
                const isToday = day === todayDate;

                return (
                  <div key={day} className={`calendar-day ${isRecorded ? 'day-recorded' : ''}`}>
                    <span className={`day-number ${isToday ? 'today-number' : ''}`}>{day}</span>
                    {isRecorded && (
                      <span className="record-pill">✓ 완료</span>
                    )}
                  </div>
                );
              })}
              {/* 그리드 정렬용 빈칸 보정 */}
              <div className="calendar-day"></div>
              <div className="calendar-day"></div>
              <div className="calendar-day"></div>
              <div className="calendar-day"></div>
            </div>
          </div>
        </div>

        {/* ================= 목표 달성률 (DB 연동) ================= */}
        <div className="premium-card goals-card">
          <div className="card-header">
            <div className="card-icon-wrapper"><TargetIcon /></div>
            <h3 className="card-title">목표 현황</h3>
          </div>
          <div>
            <div className="goal-item">
              <div className="goal-header">
                <span className="goal-name">평균 집중도 90점 달성</span>
                <span className="goal-stats">{stats?.avg_score || 0}점 ({avgScoreGoal}%)</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${avgScoreGoal}%` }}></div>
              </div>
            </div>
            <div className="goal-item mt-6">
              <div className="goal-header">
                <span className="goal-name">이번 달 10회 몰입하기</span>
                <span className="goal-stats">{stats?.total_sessions || 0}회 ({sessionGoal}%)</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${sessionGoal}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 종합 누적 기록 ================= */}
        <div className="premium-card badges-card">
          <div className="card-header">
            <div className="card-icon-wrapper"><MedalIcon /></div>
            <h3 className="card-title">종합 누적 기록</h3>
          </div>
          <div className="badge-grid">
            <div className="badge-item badge-unlocked">
              <div className="badge-icon text-2xl">⏱️</div>
              <div className="badge-info">
                <span className="badge-name">총 몰입 시간</span>
                <span className="badge-status text-indigo-600">{stats?.formatted_time || '0분'}</span>
              </div>
            </div>
            <div className="badge-item badge-unlocked">
              <div className="badge-icon text-2xl">🏅</div>
              <div className="badge-info">
                <span className="badge-name">획득한 뱃지</span>
                <span className="badge-status text-indigo-600">{stats?.badge_count || 0}개</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 최근 세션 기록 목록 ================= */}
        <div className="premium-card recent-sessions-card">
          <div className="card-header">
            <div className="card-icon-wrapper"><ListIcon /></div>
            <h3 className="card-title">최근 몰입 기록</h3>
          </div>
          <div className="session-list">
             {history.length === 0 ? (
              // Empty State UI 적용
              <div className="empty-state">
                <div className="empty-emoji">🌱</div>
                <p className="empty-title">아직 몰입 기록이 없어요</p>
                <p className="empty-desc">첫 측정을 시작하고 나만의 잔디를 심어보세요!</p>
                <button className="btn-empty-action" onClick={() => navigate('/dashboard')}>측정하러 가기</button>
              </div>
            ) : (
              history.map((session, idx) => {
                const sessionDate = new Date(session.imm_date);
                const formattedDate = `${sessionDate.getMonth() + 1}월 ${sessionDate.getDate()}일`;
                
                return (
                  <div key={idx} className="session-item" onClick={() => navigate(`/report/${session.imm_idx}`)}>
                    <div className="session-info">
                      <span className="session-date">{formattedDate}</span>
                      <span className="session-duration">
                        시작 시간: {session.start_time?.substring(0, 5)} | 
                        자세 이탈: {session.pose_count}회
                      </span>
                    </div>
                    <div className="session-score">{session.imm_score}점</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ================= 엔진 환경 설정 ================= */}
        <div className="premium-card settings-card">
          <div className="card-header">
            <div className="card-icon-wrapper"><SettingsIcon /></div>
            <h3 className="card-title">환경 설정</h3>
          </div>
          <div className="settings-content">
            
            <div>
              <div className="settings-label-row">
                <span className="settings-label">소음 경고 데시벨 기준치</span>
                <span className="settings-value">{noiseThreshold} dB</span>
              </div>
              <input 
                type="range" min="40" max="90" 
                value={noiseThreshold} onChange={(e) => setNoiseThreshold(e.target.value)}
                className="premium-slider"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.9rem', color: '#64748b', fontWeight: 700 }}>
                <span>조용함 (40dB)</span>
                <span>시끄러움 (90dB)</span>
              </div>
            </div>

            <div>
              <div className="settings-label-row" style={{ marginBottom: '16px' }}>
                <span className="settings-label">자세 영점 조절</span>
              </div>
              <button className="btn-calibrate" onClick={handleCalibration}>
                <RefreshIcon />
                바른 자세 기준 재설정하기
              </button>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}