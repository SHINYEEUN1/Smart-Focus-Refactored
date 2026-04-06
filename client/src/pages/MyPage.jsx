import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* FSD 아키텍처 규격에 따른 공통 API 모듈 임포트 */
import { immersionApi, authApi } from '../shared/api';

/* --- 공통 SVG 아이콘 컴포넌트 --- */
const UserIcon = () => <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const CameraIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const TargetIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
const MedalIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2 2 4.4l2.2-.13a2 2 0 0 1 2.2-.13L15 7.21" /><path d="M11 12h2" /><path d="M12 11v2" /></svg>;
const SettingsIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
const ListIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;

/* --- 뱃지 기준 가이드 --- */
const BADGE_GUIDE = [
  { id: 'starter', name: '초보 집중러', threshold: 100, icon: '🌱', desc: '누적 100점 달성' },
  { id: 'bronze', name: '브론즈 뱃지', threshold: 500, icon: '🥉', desc: '누적 500점 달성' },
  { id: 'silver', name: '실버 뱃지', threshold: 1000, icon: '🥈', desc: '누적 1,000점 달성' },
  { id: 'gold', name: '골드 뱃지', threshold: 2500, icon: '🥇', desc: '누적 2,500점 달성' },
  { id: 'platinum', name: '플래티넘 뱃지', threshold: 5000, icon: '💎', desc: '누적 5,000점 달성' }
];

export default function MyPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const userInfoStr = localStorage.getItem('user_info');
  const userInfo = userInfoStr ? JSON.parse(userInfoStr) : { nick: '', email: '', profile_img: null, user_idx: 1 };

  const [isLoading, setIsLoading] = useState(true);
  const [profileImg, setProfileImg] = useState(userInfo.profile_img || null);
  
  /* 설정 관련 State */
  const [noiseThreshold, setNoiseThreshold] = useState(() => parseInt(localStorage.getItem('smart_focus_noise_db')) || 65);
  const [isSoundAlert, setIsSoundAlert] = useState(() => localStorage.getItem('setting_sound_alert') !== 'false');
  const [isWeeklyReport, setIsWeeklyReport] = useState(() => localStorage.getItem('setting_weekly_report') === 'true');
  
  const [pageData, setPageData] = useState({
    stats: { total_time: "0시간 0분", avg_score: 0, bad_poses: 0, total_points: 0, total_sessions: 0, formatted_time: "0분", badge_count: 0 },
    history: [],
  });

  const [calendarDate, setCalendarDate] = useState(new Date());

  /**
   * 이미지 업로드 클릭 핸들러
   */
  const handleImageClick = () => {
    fileInputRef.current.click();
  };

  /**
   * 실제 파일 선택 및 서버 전송 로직
   */
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImg(reader.result);
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('profile_img', file);
    formData.append('user_idx', userInfo.user_idx);

    try {
      const res = await authApi.updateProfileImage(formData);
      if (res.success) {
        const newUserInfo = { ...userInfo, profile_img: res.data.profile_url };
        localStorage.setItem('user_info', JSON.stringify(newUserInfo));
        alert("프로필 이미지가 변경되었습니다.");
      }
    } catch (err) {
      console.error("이미지 업로드 실패:", err);
      alert("이미지 서버 전송에 실패했습니다.");
    }
  };

  useEffect(() => {
    if (!userInfoStr) {
      alert("로그인이 필요한 서비스입니다.");
      navigate('/login');
    }
  }, [userInfoStr, navigate]);

  useEffect(() => { localStorage.setItem('smart_focus_noise_db', noiseThreshold); }, [noiseThreshold]);
  useEffect(() => { localStorage.setItem('setting_sound_alert', isSoundAlert); }, [isSoundAlert]);
  useEffect(() => { localStorage.setItem('setting_weekly_report', isWeeklyReport); }, [isWeeklyReport]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!userInfoStr) return;
      try {
        setIsLoading(true);
        const { user_idx } = userInfo;
        const [statsResult, historyResult] = await Promise.all([
          immersionApi.getStats(user_idx),
          immersionApi.getHistory(user_idx)
        ]);
        if (statsResult.success && historyResult.success) {
          setPageData({ stats: statsResult.data, history: historyResult.data });
        }
      } catch (error) {
        console.error("API Error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, [userInfoStr]);

  const displayYear = calendarDate.getFullYear();
  const displayMonth = calendarDate.getMonth(); 

  const handlePrevMonth = () => setCalendarDate(new Date(displayYear, displayMonth - 1, 1));
  const handleNextMonth = () => setCalendarDate(new Date(displayYear, displayMonth + 1, 1));

  const firstDayIndex = new Date(displayYear, displayMonth, 1).getDay();
  const daysInMonthCount = new Date(displayYear, displayMonth + 1, 0).getDate();
  const blankDays = Array.from({ length: firstDayIndex }, (_, i) => i);
  const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

  const realToday = new Date();
  const isCurrentMonth = realToday.getFullYear() === displayYear && realToday.getMonth() === displayMonth;
  const todayDateNumber = realToday.getDate();

  const recordedDaysThisMonth = [...new Set(
    pageData.history
      .filter(item => {
        const d = new Date(item.imm_date);
        return d.getFullYear() === displayYear && d.getMonth() === displayMonth;
      })
      .map(item => new Date(item.imm_date).getDate())
  )];

  /* --- 레벨 계산 로직 추가 --- */
  const currentLevel = Math.floor((pageData.stats?.total_points || 0) / 500) + 1;
  const levelExp = (pageData.stats?.total_points || 0) % 500;

  /* --- 실시간 뱃지 개수 계산 추가 --- */
  const earnedBadgeCount = BADGE_GUIDE.filter(badge => (pageData.stats?.total_points || 0) >= badge.threshold).length;

  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#5B44F2] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold tracking-widest animate-pulse">개인 기록을 불러오고 있습니다...</p>
      </div>
    );
  }

  const { stats, history } = pageData;
  const avgScoreGoal = Math.min(100, Math.round(((stats?.avg_score || 0) / 90) * 100));
  const sessionGoal = Math.min(100, Math.round(((stats?.total_sessions || 0) / 10) * 100));

  return (
    <div className="max-w-[1200px] mx-auto pt-12 pb-24 px-6 md:px-10 font-sans text-slate-900 animate-fade-in">
      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 mb-2">마이 페이지</h1>
        <p className="text-base md:text-lg text-slate-500 font-semibold">개인 포커스 대시보드에서 성장을 확인하세요.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* [프로필 영역] */}
        <div className="lg:col-span-12 bg-white border border-slate-200 shadow-sm rounded-[1.5rem] p-8 md:p-10 flex flex-col md:flex-row justify-between items-center gap-8 transition-all hover:shadow-md hover:-translate-y-1">
          <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left w-full md:w-auto">
            {/* 프로필 이미지 컨테이너 */}
            <div className="relative group">
              <div 
                onClick={handleImageClick}
                className="w-28 h-28 bg-slate-50 border border-slate-200 rounded-[2rem] flex items-center justify-center text-slate-400 flex-shrink-0 overflow-hidden cursor-pointer transition-all hover:ring-4 hover:ring-indigo-100"
              >
                {profileImg ? (
                  <img src={profileImg} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon />
                )}
                {/* 호버 시 나타나는 카메라 오버레이 */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <CameraIcon className="text-white" />
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*" 
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3 justify-center md:justify-start">
                <span className="px-3 py-1 bg-[#5B44F2] text-white text-[10px] font-black rounded-lg uppercase tracking-wider">LV.{currentLevel}</span>
                <span className="px-3 py-1 bg-indigo-50 text-[#5B44F2] text-xs font-black tracking-widest rounded-lg border border-indigo-100 uppercase">Focus Runner</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-1 tracking-tight transition-colors">{userInfo.nick}님</h2>
              <p className="text-slate-500 font-semibold text-sm transition-colors">{userInfo.email}</p>
            </div>
          </div>
          <div className="text-center md:text-right w-full md:w-auto md:pl-12 md:border-l-2 border-slate-100">
            <div className="text-sm font-bold text-slate-500 mb-2">누적 집중 포인트</div>
            <div className="text-5xl font-black text-[#5B44F2] tracking-tighter leading-none mb-4 transition-colors">{stats?.total_points?.toLocaleString() || 0}</div>
            {/* 레벨업 프로그레스 바 추가 */}
            <div className="w-full md:w-48 bg-slate-100 h-2 rounded-full overflow-hidden mb-2 shadow-inner">
              <div className="bg-[#5B44F2] h-full transition-all duration-700 ease-out" style={{ width: `${(levelExp / 500) * 100}%` }}></div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase mb-2">Next Level: {500 - levelExp} points left</p>
            <div className="inline-block text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
              총 {stats?.total_sessions || 0}번의 집중 완료!
            </div>
          </div>
        </div>

        {/* [뱃지 도감 영역 추가] */}
        <div className="lg:col-span-12 bg-white border border-slate-200 shadow-sm rounded-[1.5rem] p-8 transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-[#5B44F2] rounded-xl flex items-center justify-center flex-shrink-0"><MedalIcon /></div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">집중 뱃지 도감</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {BADGE_GUIDE.map((badge) => {
              const isEarned = (stats?.total_points || 0) >= badge.threshold;
              return (
                <div key={badge.id} className={`flex flex-col items-center p-6 rounded-3xl border transition-all duration-300 ${isEarned ? 'bg-white border-indigo-100 shadow-sm scale-100' : 'bg-slate-50/50 border-transparent opacity-40 grayscale scale-95'}`}>
                  <span className="text-4xl mb-3 drop-shadow-sm">{badge.icon}</span>
                  <span className="text-sm font-black text-slate-900 mb-1">{badge.name}</span>
                  <span className="text-[10px] font-bold text-[#5B44F2] bg-indigo-50 px-2 py-0.5 rounded-md whitespace-nowrap">{badge.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* [달력 영역] */}
        <div className="lg:col-span-12 bg-white border border-slate-200 shadow-sm rounded-[1.5rem] p-8 transition-all hover:shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">{displayYear}년 {displayMonth + 1}월의 집중 기록</h3>
            <div className="flex gap-2">
              <button onClick={handlePrevMonth} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors active:scale-95">이전 달</button>
              <button onClick={handleNextMonth} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors active:scale-95">다음 달</button>
            </div>
          </div>

          <div className="border-t border-l border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="grid grid-cols-7 bg-slate-50 text-center font-bold text-xs text-slate-500 py-3 border-b border-slate-200">
              <span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>
            </div>
            <div className="grid grid-cols-7">
              {blankDays.map((_, idx) => (
                <div key={`blank-${idx}`} className="min-h-[90px] border-b border-r border-slate-200 bg-slate-50/50 p-2"></div>
              ))}
              {daysInMonth.map((day) => {
                const isRecorded = recordedDaysThisMonth.includes(day);
                const isToday = isCurrentMonth && day === todayDateNumber;
                return (
                  <div key={day} className={`min-h-[90px] border-b border-r border-slate-200 p-2 flex flex-col transition-colors ${isRecorded ? 'bg-indigo-50/30 hover:bg-indigo-50/50' : 'bg-white hover:bg-slate-50'}`}>
                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-[#5B44F2] text-white' : (isRecorded ? 'text-slate-900' : 'text-slate-400')}`}>
                      {day}
                    </span>
                    {isRecorded && <span className="mt-auto inline-block text-center text-[10px] font-black text-[#5B44F2] bg-indigo-50 border border-indigo-100 rounded-md py-1 px-1">✓ 완료</span>}
                  </div>
                );
              })}
              {Array.from({ length: (7 - ((blankDays.length + daysInMonth.length) % 7)) % 7 }).map((_, idx) => (
                <div key={`end-blank-${idx}`} className="min-h-[90px] border-b border-r border-slate-200 bg-slate-50/50 p-2"></div>
              ))}
            </div>
          </div>
        </div>

        {/* [목표 영역] */}
        <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-[1.5rem] p-8 transition-all hover:shadow-md hover:-translate-y-1 h-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-[#5B44F2] rounded-xl flex items-center justify-center flex-shrink-0"><TargetIcon /></div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">집중 목표 현황</h3>
          </div>
          <div className="space-y-8">
            <div>
              <div className="flex justify-between items-end mb-3">
                <span className="font-bold text-slate-900 text-base">평균 집중도 90점 달성</span>
                <span className="font-bold text-slate-500 text-sm">{stats?.avg_score || 0}점 ({avgScoreGoal}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#5B44F2] rounded-full transition-all duration-500" style={{ width: `${avgScoreGoal}%` }}></div></div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-3">
                <span className="font-bold text-slate-900 text-base">이번 달 10회 집중하기</span>
                <span className="font-bold text-slate-500 text-sm">{stats?.total_sessions || 0}회 ({sessionGoal}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#5B44F2] rounded-full transition-all duration-500" style={{ width: `${sessionGoal}%` }}></div></div>
            </div>
          </div>
        </div>

        {/* [누적 기록 영역] */}
        <div className="lg:col-span-7 bg-white border border-slate-200 shadow-sm rounded-[1.5rem] p-8 transition-all hover:shadow-md hover:-translate-y-1 h-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-[#5B44F2] rounded-xl flex items-center justify-center flex-shrink-0"><MedalIcon /></div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">종합 누적 기록</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-5 bg-white border border-indigo-100 rounded-2xl shadow-sm shadow-indigo-50">
              <div className="w-14 h-14 bg-indigo-50 text-[#5B44F2] rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">⏱️</div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-900 text-base truncate">총 집중 시간</span>
                <span className="font-black text-[#5B44F2] mt-1 truncate">{stats?.formatted_time || '0분'}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5 bg-white border border-indigo-100 rounded-2xl shadow-sm shadow-indigo-50">
              <div className="w-14 h-14 bg-indigo-50 text-[#5B44F2] rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">🏅</div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-900 text-base truncate">획득한 뱃지</span>
                {/* 기존 stats.badge_count 대신 earnedBadgeCount 렌더링 */}
                <span className="font-black text-[#5B44F2] mt-1 truncate">{earnedBadgeCount}개</span>
              </div>
            </div>
          </div>
        </div>

        {/* [최근 기록 영역] */}
        <div className="lg:col-span-6 bg-white border border-slate-200 shadow-sm rounded-[1.5rem] p-8 transition-all hover:shadow-md hover:-translate-y-1 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 text-[#5B44F2] rounded-xl flex items-center justify-center flex-shrink-0"><ListIcon /></div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">최근 집중 기록</h3>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[380px] pr-2 pb-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            {history.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="font-bold text-slate-900 mb-1 text-4xl">🌱</p>
                <p className="font-bold text-slate-900">아직 집중 기록이 없어요</p>
                <button onClick={() => navigate('/dashboard')} className="mt-4 px-5 py-2.5 bg-[#5B44F2] text-white font-bold text-sm rounded-xl hover:bg-[#4a36c4] transition-colors">측정 시작</button>
              </div>
            ) : (
              history.map((session, idx) => (
                <div key={idx} onClick={() => navigate(`/report/${session.imm_idx}`)} className="flex justify-between items-center p-5 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group shrink-0">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="font-black text-slate-900 text-lg group-hover:text-[#5B44F2] transition-colors truncate">{new Date(session.imm_date).getMonth() + 1}월 {new Date(session.imm_date).getDate()}일</span>
                    <span className="text-xs font-semibold text-slate-500 truncate">시작: {session.start_time?.substring(0, 5)} | 이탈: {session.pose_count}회</span>
                  </div>
                  <div className="text-xl font-black text-[#5B44F2] bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex-shrink-0">{session.imm_score}점</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* [환경 설정 영역] */}
        <div className="lg:col-span-6 bg-white border border-slate-200 shadow-sm rounded-[1.5rem] p-8 transition-all hover:shadow-md h-full flex flex-col">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-indigo-50 text-[#5B44F2] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"><SettingsIcon /></div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">환경 설정</h3>
          </div>
          <div className="flex flex-col gap-8 flex-grow">
            <div className="pb-8 border-b border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-slate-900 text-[15px]">소음 경고 데시벨 기준치</span>
                <span className="font-black text-[#5B44F2] bg-[#5B44F2]/10 px-4 py-1.5 rounded-xl text-sm tracking-wide">{noiseThreshold} dB</span>
              </div>
              <div className="relative pt-1">
                <input type="range" min="40" max="90" value={noiseThreshold} onChange={(e) => setNoiseThreshold(e.target.value)} className="w-full h-1.5 rounded-full outline-none appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #5B44F2 ${(noiseThreshold - 40) / 50 * 100}%, #e2e8f0 0%)` }} />
                <style>{`input[type=range]::-webkit-slider-thumb {-webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #5B44F2; cursor: pointer; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);}`}</style>
              </div>
              <div className="flex justify-between mt-4 text-[12px] font-bold text-slate-400"><span>조용함 (40dB)</span><span>시끄러움 (90dB)</span></div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-4"><p className="font-bold text-slate-900 text-[15px]">경고음 알림</p><p className="text-xs text-slate-500 font-semibold mt-1 truncate">자세 이탈이나 소음 감지 시 효과음 재생</p></div>
                <button onClick={() => setIsSoundAlert(!isSoundAlert)} className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${isSoundAlert ? 'bg-[#5B44F2]' : 'bg-slate-200'}`}><span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isSoundAlert ? 'translate-x-6' : 'translate-x-0'}`}></span></button>
              </div>
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-4"><p className="font-bold text-slate-900 text-[15px]">주간 리포트 메일 수신</p><p className="text-xs text-slate-500 font-semibold mt-1 truncate">매주 월요일 분석 결과 발송</p></div>
                <button onClick={() => setIsWeeklyReport(!isWeeklyReport)} className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${isWeeklyReport ? 'bg-[#5B44F2]' : 'bg-slate-200'}`}><span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isWeeklyReport ? 'translate-x-6' : 'translate-x-0'}`}></span></button>
              </div>
            </div>
            <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between items-center"><button className="text-sm font-bold text-slate-400 hover:text-slate-800 transition-colors">비밀번호 변경</button><button className="text-sm font-bold text-rose-400 hover:text-rose-600 transition-colors">회원 탈퇴</button></div>
          </div>
        </div>

      </div>
    </div>
  );
}