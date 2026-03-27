// MyPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './MyPage.css'; 

// --- 미니멀 SVG 아이콘 ---
const UserIcon = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const TargetIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const MedalIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><polyline points="12 18 12 15 9 15"/></svg>;
const SettingsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const CalendarIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const ListIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const RefreshIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>;
const StarIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const ShieldIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const HeadphoneIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>;
const FlameIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;

export default function MyPage() {
  const navigate = useNavigate();
  const [noiseThreshold, setNoiseThreshold] = useState(60);

  // 데이터 세팅
  const goals = [
    { label: '이번 주 총 몰입 시간', current: 35, target: 40, unit: '시간' },
    { label: '평균 집중 점수', current: 88, target: 90, unit: '점' },
    { label: '자세 교정 목표', current: 75, target: 80, unit: '%' },
  ];

  const badges = [
    { id: 1, name: "첫 몰입 성공", icon: <StarIcon />, unlocked: true },
    { id: 2, name: "바른 자세 지킴이", icon: <ShieldIcon />, unlocked: true },
    { id: 3, name: "소음 방어 마스터", icon: <HeadphoneIcon />, unlocked: false },
    { id: 4, name: "몰입의 달인", icon: <FlameIcon />, unlocked: false },
  ];

  const recentSessions = [
    { id: 'session_123', date: '오늘 오전 10:30', duration: '45분', score: 92 },
    { id: 'session_122', date: '어제 오후 2:00', duration: '1시간 20분', score: 85 },
    { id: 'session_121', date: '3월 25일', duration: '50분', score: 78 },
  ];

  // --------------------------------------------------------
  // 📅 깔끔한 월간 달력 데이터 로직 (2026년 3월 기준 세팅)
  // --------------------------------------------------------
  const todayDate = 27; // 현재 날짜 하이라이트용
  const recordedDays = [5, 12, 18, 24, 25, 26, 27]; // 뱃지가 찍힐 기록이 있는 날들

  // 3월 달력 배열 생성 (31일까지)
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleCalibration = () => {
    alert("영점 조절을 시작합니다. 바른 자세로 3초간 유지해주세요!");
  };

  return (
    <div className="premium-mypage-wrapper">
      <header className="premium-header">
        <h1 className="premium-title">마이 페이지</h1>
        <p className="premium-subtitle">개인 포커스 대시보드에서 성장을 확인하세요.</p>
      </header>

      <div className="grid-layout">
        
        {/* 프로필 & 포인트 */}
        <div className="premium-card profile-card">
          <div className="profile-left">
            <div className="profile-avatar"><UserIcon /></div>
            <div>
              <span className="profile-tag">FOCUS RUNNER</span>
              <h2 className="profile-name">홍길동님</h2>
              <p className="profile-desc">포커스 리더 등급: 마스터</p>
            </div>
          </div>
          <div className="points-wrapper">
            <div className="points-label">보유 포인트</div>
            <div className="points-value">12,500</div>
            <div className="points-change">이번 달 +2450pt ↑</div>
          </div>
        </div>

        {/* 📅 직관적이고 세련된 월간 달력 */}
        <div className="premium-card calendar-card">
          <div className="calendar-top-nav">
            <h3 className="calendar-month-title">2026년 3월의 몰입 기록</h3>
            <div>
              <button className="calendar-nav-btn" style={{ marginRight: '8px' }}>이전 달</button>
              <button className="calendar-nav-btn">다음 달</button>
            </div>
          </div>

          <div className="calendar-container">
            {/* 요일 헤더 */}
            <div className="calendar-weekdays">
              <span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>
            </div>
            
            {/* 날짜 그리드 */}
            <div className="calendar-days-grid">
              {daysInMonth.map((day) => {
                const isRecorded = recordedDays.includes(day);
                const isToday = day === todayDate;

                return (
                  <div key={day} className={`calendar-day ${isRecorded ? 'day-recorded' : ''}`}>
                    <span className={`day-number ${isToday ? 'today-number' : ''}`}>{day}</span>
                    {/* 기록이 있는 날에만 예쁜 뱃지 표시 */}
                    {isRecorded && (
                      <span className="record-pill">✓ 완료</span>
                    )}
                  </div>
                );
              })}
              {/* 31일 이후 남는 빈칸 채우기용 (달력 레이아웃 맞춤) */}
              <div className="calendar-day"></div>
              <div className="calendar-day"></div>
              <div className="calendar-day"></div>
              <div className="calendar-day"></div>
            </div>
          </div>
        </div>

        {/* 목표 현황 */}
        <div className="premium-card goals-card">
          <div className="card-header">
            <div className="card-icon-wrapper"><TargetIcon /></div>
            <h3 className="card-title">목표 현황</h3>
          </div>
          <div>
            {goals.map((goal, idx) => {
              const progress = Math.round((goal.current / goal.target) * 100);
              return (
                <div key={idx} className="goal-item">
                  <div className="goal-header">
                    <span className="goal-name">{goal.label}</span>
                    <span className="goal-stats">{goal.current} / {goal.target}{goal.unit} ({progress}%)</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 획득 뱃지 */}
        <div className="premium-card badges-card">
          <div className="card-header">
            <div className="card-icon-wrapper"><MedalIcon /></div>
            <h3 className="card-title">전체 획득 뱃지</h3>
          </div>
          <div className="badge-grid">
            {badges.map((badge) => (
              <div key={badge.id} className={`badge-item ${badge.unlocked ? 'badge-unlocked' : 'badge-locked'}`}>
                <div className="badge-icon">{badge.icon}</div>
                <div className="badge-info">
                  <span className="badge-name">{badge.name}</span>
                  <span className="badge-status">{badge.unlocked ? '획득 완료' : '미획득'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 최근 기록 */}
        <div className="premium-card recent-sessions-card">
          <div className="card-header">
            <div className="card-icon-wrapper"><ListIcon /></div>
            <h3 className="card-title">최근 몰입 기록</h3>
          </div>
          <div className="session-list">
            {recentSessions.map((session) => (
              <div key={session.id} className="session-item" onClick={() => navigate(`/report/${session.id}`)}>
                <div className="session-info">
                  <span className="session-date">{session.date}</span>
                  <span className="session-duration">집중 시간: {session.duration}</span>
                </div>
                <div className="session-score">{session.score}점</div>
              </div>
            ))}
          </div>
        </div>

        {/* 설정 및 캘리브레이션 */}
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