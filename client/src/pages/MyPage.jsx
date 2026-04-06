import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { immersionApi, authApi } from '../shared/api';

/**
 * [마이페이지 - 한국어 최적화 및 뱃지 컬렉션 최종본]
 * - 뱃지 상점 -> 뱃지 컬렉션 개념으로 전환 (결제 버튼 삭제 및 자동 획득 안내 추가)
 * - '몰입' -> '집중' 문구 일괄 교체 완비
 * - 달력 헤더(SUN~SAT)를 한국어(일~토)로 변경
 * - 비밀번호 변경 및 탈퇴 버튼 삭제 완료
 * - [수정] 미사용 아이콘(Dead Code) 제거 및 목표 현황 표기 단위(%) 통일
 */
const UserIcon = () => <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const CameraIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;

const BADGE_GUIDE = [
  { id: 'starter', name: '초보 집중러', threshold: 100, icon: '🌱' },
  { id: 'bronze', name: '브론즈 뱃지', threshold: 500, icon: '🥉' },
  { id: 'silver', name: '실버 뱃지', threshold: 1000, icon: '🥈' },
  { id: 'gold', name: '골드 뱃지', threshold: 2500, icon: '🥇' },
  { id: 'platinum', name: '플래티넘 뱃지', threshold: 5000, icon: '💎' }
];

export default function MyPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const userInfoStr = localStorage.getItem('user_info');
  const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;

  const [isLoading, setIsLoading] = useState(true);
  const [profileImg, setProfileImg] = useState(userInfo?.profile_img || null);
  const [noiseThreshold, setNoiseThreshold] = useState(() => parseInt(localStorage.getItem('smart_focus_noise_db')) || 65);
  const [isSoundAlert, setIsSoundAlert] = useState(() => localStorage.getItem('setting_sound_alert') !== 'false');
  const [isWeeklyReport, setIsWeeklyReport] = useState(() => localStorage.getItem('setting_weekly_report') === 'true');
  
  const [pageData, setPageData] = useState({
    stats: { total_points: 0, avg_score: 0, total_sessions: 0, badge_count: 0, formatted_time: "0분" },
    history: [],
  });

  const [calendarDate, setCalendarDate] = useState(new Date());

  const handleImageClick = () => fileInputRef.current.click();
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfileImg(reader.result);
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('profile_img', file);
    formData.append('user_idx', userInfo.user_idx);
    try {
      const res = await authApi.updateProfileImage(formData);
      if (res.success) {
        localStorage.setItem('user_info', JSON.stringify({ ...userInfo, profile_img: res.data.profile_url }));
        alert("프로필 이미지가 변경되었습니다.");
      }
    } catch (err) { alert("이미지 업로드 실패"); }
  };

  useEffect(() => {
    if (!userInfo) { navigate('/login'); return; }
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const [statsRes, histRes] = await Promise.all([
          immersionApi.getStats(userInfo.user_idx),
          immersionApi.getHistory(userInfo.user_idx)
        ]);
        if (statsRes.success && histRes.success) {
          setPageData({ stats: statsRes.data ?? pageData.stats, history: histRes.data ?? [] });
        }
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchAllData();
  }, [userInfo?.user_idx, navigate]);

  useEffect(() => {
    localStorage.setItem('smart_focus_noise_db', noiseThreshold);
    localStorage.setItem('setting_sound_alert', isSoundAlert);
    localStorage.setItem('setting_weekly_report', isWeeklyReport);
  }, [noiseThreshold, isSoundAlert, isWeeklyReport]);

  if (isLoading) return <div className="min-h-[85vh] flex flex-col items-center justify-center gap-4"><div className="w-12 h-12 border-4 border-[#5B44F2] border-t-transparent rounded-full animate-spin"></div><p className="text-slate-500 font-black animate-pulse">개인 대시보드를 불러오는 중...</p></div>;

  const currentLevel = Math.floor((pageData.stats?.total_points || 0) / 500) + 1;
  const levelExp = (pageData.stats?.total_points || 0) % 500;

  const displayYear = calendarDate.getFullYear(); const displayMonth = calendarDate.getMonth();
  const daysInMonthCount = new Date(displayYear, displayMonth + 1, 0).getDate();
  const blankDays = Array.from({ length: new Date(displayYear, displayMonth, 1).getDay() }, (_, i) => i);
  const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);
  const recordedDaysThisMonth = [...new Set(pageData.history.filter(item => {
    const d = new Date(item.imm_date);
    return d.getFullYear() === displayYear && d.getMonth() === displayMonth;
  }).map(item => new Date(item.imm_date).getDate()))];

  const avgGoal = Math.min(100, Math.round(((pageData.stats?.avg_score || 0) / 90) * 100));

  return (
    <div className="max-w-[1200px] mx-auto pt-12 pb-24 px-6 md:px-10 font-sans text-slate-900 animate-fade-in selection:bg-indigo-100">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter uppercase">나의 집중 대시보드</h1>
        <p className="text-slate-500 font-semibold text-lg">성장 데이터와 뱃지 컬렉션을 한눈에 관리하세요.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-slate-900">
        
        <div className="lg:col-span-12 bg-white border border-slate-200 rounded-[2.5rem] p-10 flex flex-col md:flex-row justify-between items-center transition-all hover:shadow-2xl shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-10 text-center md:text-left relative">
            <div onClick={handleImageClick} className="relative w-32 h-32 bg-slate-50 border border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-400 overflow-hidden cursor-pointer shadow-sm group">
              {profileImg ? <img src={profileImg} className="w-full h-full object-cover" alt="프로필" /> : <UserIcon />}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><CameraIcon className="text-white"/></div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            <div>
              <div className="flex gap-2 mb-4 justify-center md:justify-start">
                <span className="px-3 py-1 bg-[#5B44F2] text-white text-[10px] font-black rounded-lg uppercase tracking-wider">레벨 {currentLevel}</span>
                <span className="px-3 py-1 bg-indigo-50 text-[#5B44F2] text-xs font-black rounded-lg border border-indigo-100 uppercase tracking-widest">포커스 러너</span>
              </div>
              <h2 className="text-4xl font-black mb-1 tracking-tight">{userInfo?.nick}님</h2>
              <p className="text-slate-500 font-semibold">{userInfo?.email}</p>
            </div>
          </div>
          <div className="mt-10 md:mt-0 text-center md:text-right md:pl-16 md:border-l-2 border-slate-100">
            <div className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">누적 포인트</div>
            <div className="text-6xl font-black text-[#5B44F2] mb-5 tracking-tighter">{(pageData.stats?.total_points || 0).toLocaleString()} pt</div>
            <div className="w-56 bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3 shadow-inner">
              <div className="bg-[#5B44F2] h-full transition-all duration-1000 ease-out" style={{ width: `${(levelExp / 500) * 100}%` }}></div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">다음 레벨까지: {500 - levelExp} pt 남음</p>
          </div>
        </div>

        <div className="lg:col-span-12 bg-white border border-slate-200 rounded-[2rem] p-10 transition-all hover:shadow-2xl shadow-sm">
          <div className="flex justify-between items-center mb-10 pb-4 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 text-[#5B44F2] rounded-2xl flex items-center justify-center shadow-sm font-bold text-xl">🏆</div>
              <h3 className="text-2xl font-bold tracking-tight">집중 뱃지 컬렉션</h3>
            </div>
            <span className="text-sm font-black text-[#5B44F2] bg-indigo-50 px-6 py-3 rounded-2xl border border-indigo-100 shadow-inner">보유 포인트: {(pageData.stats?.total_points || 0).toLocaleString()} pt</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {BADGE_GUIDE.map((badge, idx) => {
              const isEarned = (pageData.stats?.badge_count || 0) > idx;
              return (
                <div key={badge.id} className={`flex flex-col items-center p-8 rounded-[2.5rem] border transition-all duration-300 ${isEarned ? 'bg-white border-indigo-100 shadow-lg scale-100' : 'bg-slate-50 opacity-60 grayscale scale-95'}`}>
                  <span className="text-5xl mb-5 drop-shadow-md">{badge.icon}</span>
                  <span className="text-base font-black text-slate-900 mb-1">{badge.name}</span>
                  <div className="mt-6 w-full flex justify-center">
                    {isEarned ? (
                      <span className="text-xs font-bold text-white bg-[#5B44F2] px-4 py-2.5 rounded-xl block text-center shadow-md w-full">보유 중</span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-200 px-2 py-2.5 rounded-xl block text-center w-full tracking-tight break-keep">
                        {badge.threshold}pt 자동 획득
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-12 bg-white border border-slate-200 shadow-sm rounded-[2rem] p-10 transition-all hover:shadow-2xl shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">{displayYear}년 {displayMonth + 1}월 집중 캘린더</h3>
            <div className="flex gap-2">
              <button onClick={() => setCalendarDate(new Date(displayYear, displayMonth - 1, 1))} className="px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-white transition-all shadow-sm">이전 달</button>
              <button onClick={() => setCalendarDate(new Date(displayYear, displayMonth + 1, 1))} className="px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-white transition-all shadow-sm">다음 달</button>
            </div>
          </div>
          <div className="border border-slate-100 rounded-[1.5rem] overflow-hidden bg-slate-50/30">
            <div className="grid grid-cols-7 bg-slate-100/50 text-center font-black text-[10px] text-slate-400 py-4 border-b border-slate-100 uppercase">
              {['일', '월', '화', '수', '목', '금', '토'].map(d => <span key={d}>{d}</span>)}
            </div>
            <div className="grid grid-cols-7">
              {blankDays.map(i => <div key={`b-${i}`} className="min-h-[100px] border-b border-r border-slate-100 bg-slate-50/20"></div>)}
              {daysInMonth.map(day => {
                const isRec = recordedDaysThisMonth.includes(day);
                const isToday = new Date().getDate() === day && new Date().getMonth() === displayMonth;
                return (
                  <div key={day} className={`min-h-[100px] border-b border-r border-slate-100 p-3 flex flex-col items-center justify-between transition-colors ${isRec ? 'bg-indigo-50/40' : 'bg-white hover:bg-slate-50'}`}>
                    <span className={`text-xs font-black w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-[#5B44F2] text-white shadow-lg' : 'text-slate-400'}`}>{day}</span>
                    {isRec && <div className="bg-[#5B44F2] text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-sm animate-fade-in">✓ 집중</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 shadow-sm rounded-[2rem] p-10 transition-all hover:shadow-2xl shadow-sm flex flex-col h-full">
          <h3 className="text-xl font-black text-slate-900 mb-10 uppercase tracking-widest flex items-center gap-3"><span className="w-1.5 h-6 bg-emerald-400 rounded-full"></span>집중 목표 현황</h3>
          <div className="space-y-10 flex-grow">
            <div>
              <div className="flex justify-between items-end mb-4"><span className="font-bold text-slate-700 text-sm">평균 집중도 목표 (100%)</span><span className="font-black text-[#5B44F2] text-sm">{avgGoal}%</span></div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-emerald-400 to-[#5B44F2] transition-all duration-1000" style={{ width: `${avgGoal}%` }}></div></div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-4"><span className="font-bold text-slate-700 text-sm">주간 측정 횟수 (10회)</span><span className="font-black text-[#5B44F2] text-sm">{pageData.stats?.total_sessions || 0}/10</span></div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-indigo-300 to-[#5B44F2] transition-all duration-1000" style={{ width: `${Math.min(100, (pageData.stats?.total_sessions || 0) * 10)}%` }}></div></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 shadow-sm rounded-[2rem] p-10 transition-all hover:shadow-2xl shadow-sm h-full flex flex-col overflow-hidden">
          <h3 className="text-xl font-black text-slate-900 mb-8 uppercase tracking-widest flex items-center gap-3"><span className="w-1.5 h-6 bg-[#5B44F2] rounded-full"></span>최근 집중 세션</h3>
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
            {pageData.history.length === 0 ? <div className="py-20 text-center text-slate-400 font-bold">집중 기록이 존재하지 않습니다.</div> : pageData.history.map((s, i) => (
              <div key={i} onClick={() => navigate(`/report/${s.imm_idx}`)} className="flex justify-between items-center p-6 bg-slate-50 border border-slate-100 rounded-3xl cursor-pointer hover:bg-white hover:border-[#5B44F2]/30 transition-all group shrink-0 shadow-sm">
                <div className="flex flex-col gap-1.5"><span className="font-black text-slate-900 text-lg group-hover:text-[#5B44F2] transition-colors">{new Date(s.imm_date).toLocaleDateString()} 리포트</span><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">시작 시각: {s.start_time?.substring(0, 5)} | 집중 시간: {s.formatted_time || '0분'}</span></div>
                <div className="text-2xl font-black text-[#5B44F2] bg-white px-5 py-2.5 rounded-2xl border border-indigo-50 shadow-inner group-hover:bg-[#5B44F2] group-hover:text-white transition-colors">{s.imm_score}pt</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-12 bg-white border border-slate-200 shadow-sm rounded-[2rem] p-12 transition-all hover:shadow-2xl shadow-sm">
          <h3 className="text-xl font-black text-slate-900 mb-12 uppercase tracking-widest flex items-center gap-3"><span className="w-1.5 h-6 bg-[#5B44F2] rounded-full"></span>시스템 환경 설정</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-10">
              <div>
                <div className="flex justify-between items-center mb-6"><span className="font-black text-slate-700 text-sm uppercase tracking-widest">소음 임계치 경고 (dB)</span><span className="font-black text-[#5B44F2] text-lg">{noiseThreshold} dB</span></div>
                <input type="range" min="40" max="90" value={noiseThreshold} onChange={(e) => setNoiseThreshold(e.target.value)} className="w-full h-1.5 rounded-full outline-none appearance-none cursor-pointer shadow-inner" style={{ background: `linear-gradient(to right, #5B44F2 ${(noiseThreshold-40)/50*100}%, #e2e8f0 0%)` }} />
                <div className="flex justify-between mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>정숙함 (40dB)</span><span>시끄러움 (90dB)</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-8 md:pl-12 md:border-l border-slate-100">
              <div className="flex items-center justify-between"><div className="min-w-0 pr-4"><p className="font-black text-slate-700 text-sm uppercase tracking-tight">실시간 사운드 알림</p><p className="text-[11px] text-slate-400 font-bold mt-1">자세 이탈이나 고소음 감지 시 효과음 재생</p></div><button onClick={() => setIsSoundAlert(!isSoundAlert)} className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 shadow-inner ${isSoundAlert ? 'bg-[#5B44F2]' : 'bg-slate-200'}`}><span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${isSoundAlert ? 'translate-x-6' : 'translate-x-0'}`}></span></button></div>
              <div className="flex items-center justify-between"><div className="min-w-0 pr-4"><p className="font-black text-slate-700 text-sm uppercase tracking-tight">주간 집중 분석 레터</p><p className="text-[11px] text-slate-400 font-bold mt-1">매주 월요일 사용자님의 집중 데이터를 요약 발송</p></div><button onClick={() => setIsWeeklyReport(!isWeeklyReport)} className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 shadow-inner ${isWeeklyReport ? 'bg-[#5B44F2]' : 'bg-slate-200'}`}><span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${isWeeklyReport ? 'translate-x-6' : 'translate-x-0'}`}></span></button></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}