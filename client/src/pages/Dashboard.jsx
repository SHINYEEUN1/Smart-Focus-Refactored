import React, { useEffect, useRef, useState } from 'react';
import Card from '../components/Card';
// 로컬 AI 엔진은 더 이상 메인 판정에 쓰지 않지만, 영점 조절 등 유틸리티용으로 남겨둡니다.
import { evaluateSmartFocus, resetStaticTracking } from '../SFEngine';
// 실시간 통신을 위한 웹소켓 클라이언트
import { io } from 'socket.io-client';

export default function Dashboard() {
  // --- 📷 카메라 및 오디오 관련 Refs ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const audioContextRef = useRef(null);
  const poseRef = useRef(null);
  const faceMeshRef = useRef(null);
  
  // --- 🔌 소켓 및 데이터 상태 보관용 Refs ---
  const socketRef = useRef(null); // 백엔드와 연결된 전화선(소켓)
  const faceLandmarksRef = useRef(null); 
  const decibelRef = useRef(0); // 콜백 함수 안에서도 최신 소음 값을 유지하기 위해 Ref 사용
  const calibrationRef = useRef(null); 
  const needsCalibrationRef = useRef(false);
  const lastSentTimeRef = useRef(0); // 1초 간격 측정을 위한 타이머 기록

  // --- 💡 화면에 보여질 상태(State) 값들 ---
  const [decibel, setDecibel] = useState(0); // 화면 표시용 소음 수치
  const [isFocusing, setIsFocusing] = useState(false); // 측정 중인지 여부
  const [engineResult, setEngineResult] = useState(null); // 로컬 모델 로딩 상태 확인용
  const [focusSeconds, setFocusSeconds] = useState(0); // 진행 시간 (초)
  const [historyLog, setHistoryLog] = useState([]); // 하단 표에 들어갈 5개 기록
  
  // 서버에서 보내주는 진짜 AI 피드백 상태
  const [serverFeedback, setServerFeedback] = useState("측정을 시작하려면 상단의 '▶ 측정 시작' 버튼을 눌러주세요.");
  const [serverStatus, setServerStatus] = useState('--'); // NORMAL, CAUTION, WARNING

  // ==========================================
  // 1. 컴포넌트 실행 시 웹소켓 연결 세팅
  // ==========================================
  useEffect(() => {
    // 백엔드(3000번 포트)와 실시간 연결 시작
    socketRef.current = io('http://localhost:3000', {
      withCredentials: true, 
    });

    socketRef.current.on('engine_ready', (data) => {
      console.log("🟢 [서버 연결]:", data.message);
    });

    // ✨ [핵심 해결 포인트] 서버에서 분석 결과가 도착했을 때!
    // 여기서 표(historyLog)를 업데이트해야 항상 최신 점수와 상태가 반영됩니다.
    socketRef.current.on('analysis_result', (data) => {
      if (data.status === 'SUCCESS') {
        // 백엔드 상태(GOOD_POSTURE 등)를 프론트엔드 UI 규격(NORMAL 등)으로 변환
        const currentStatus = data.postureStatus === 'GOOD_POSTURE' ? 'NORMAL' : data.postureStatus === 'SLUMPED' ? 'WARNING' : 'CAUTION';
        
        // 화면 중앙 피드백과 아이콘 상태 업데이트
        setServerFeedback(data.message);
        setServerStatus(currentStatus);

        // 하단 표에 들어갈 점수와 시간 계산
        const dynamicScore = currentStatus === 'NORMAL' ? '96%' : currentStatus === 'CAUTION' ? '72%' : '45%'; 
        const time = new Date().toLocaleTimeString('ko-KR'); 
        
        // 표 기록 추가 (최신 5개만 유지)
        setHistoryLog(prev => [{ 
          detected_at: time, 
          pose_status: currentStatus, 
          imm_score: dynamicScore, 
          decibel: `${decibelRef.current} dB` 
        }, ...prev].slice(0, 5));

      } else {
        setServerFeedback(data.message); // 예외 메시지 (ex. 사용자 없음) 처리
      }
    });

    // 화면(컴포넌트)이 꺼질 때 소켓 연결도 깔끔하게 종료
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // ==========================================
  // 2. 진행 시간(타이머) 로직
  // ==========================================
  useEffect(() => {
    let interval;
    if (isFocusing) { interval = setInterval(() => setFocusSeconds(p => p + 1), 1000); }
    else { clearInterval(interval); }
    return () => clearInterval(interval); 
  }, [isFocusing]);

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ==========================================
  // 3. 카메라 및 마이크 측정 시작 로직
  // ==========================================
  const startCamera = async () => {
    setServerFeedback("AI 모델을 로딩 중입니다. 잠시만 대기해주세요...");
    
    // 외부 라이브러리(Mediapipe) 스크립트 로드
    const loadScript = (src) => new Promise((res) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; document.body.appendChild(s);
    });
    if (!window.Pose) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
    if (!window.FaceMesh) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
    if (!window.Camera) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

    // 🎤 마이크 소음(데시벨) 측정 세팅
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext(); audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser(); const source = audioCtx.createMediaStreamSource(stream); source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateDecibel = () => {
        if (!audioContextRef.current) return; 
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const currentDb = Math.round(avg * 1.5); 
        decibelRef.current = currentDb; // Ref 업데이트 (소켓 통신 시 최신값 참조용)
        setDecibel(currentDb); // 화면 표시용 State 업데이트
        requestAnimationFrame(updateDecibel); 
      };
      updateDecibel();
    } catch(err) { console.error("마이크 오류", err); }

    // 📷 카메라 및 AI 모델 세팅
    const SafePose = window.Pose; const SafeCamera = window.Camera; const SafeFaceMesh = window.FaceMesh; 
    const faceMesh = new SafeFaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    const pose = new SafePose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    faceMeshRef.current = faceMesh; poseRef.current = pose;

    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

    faceMesh.onResults((res) => { faceLandmarksRef.current = res.multiFaceLandmarks?.[0] || null; });
    
    // 뼈대 좌표가 잡힐 때마다(거의 0.1초마다) 실행되는 곳
    pose.onResults((res) => {
      if (!canvasRef.current || !res.poseLandmarks) return;
      
      // 뼈대 그리기 (초록색 선과 점)
      const ctx = canvasRef.current.getContext('2d'); ctx.save(); ctx.clearRect(0, 0, 640, 480);
      ctx.strokeStyle = "rgba(234, 255, 113, 0.8)"; ctx.lineWidth = 2;
      res.poseLandmarks.forEach(p => { ctx.beginPath(); ctx.arc(p.x * 640, p.y * 480, 3, 0, 2 * Math.PI); ctx.fillStyle = "#D9F99D"; ctx.fill(); ctx.stroke(); }); ctx.restore();

      if (needsCalibrationRef.current) { calibrationRef.current = { distY: Math.abs(res.poseLandmarks[7].y - res.poseLandmarks[11].y) }; needsCalibrationRef.current = false; }
      
      // 로컬 화면 렌더링 확인용 더미 엔진
      const analysis = evaluateSmartFocus({ landmarks: res.poseLandmarks, faceLandmarks: faceLandmarksRef.current, db: decibelRef.current }, calibrationRef.current);
      setEngineResult(analysis);

      // ✨ 딱 1초(1000ms)가 지났는지 검사해서, 1초마다 백엔드로 데이터 발송
      const now = Date.now();
      if (now - lastSentTimeRef.current >= 1000) { 
        lastSentTimeRef.current = now; 
        
        // 서버의 app.js에 있는 'stream_data' 수신부로 뼈대 데이터와 데시벨을 전송합니다.
        if (socketRef.current) {
          socketRef.current.emit('stream_data', {
            landmarks: res.poseLandmarks, 
            noiseDb: decibelRef.current   
          });
        }
        // (주의) 여기서 historyLog를 찍으면 옛날 값이 기록됩니다! 그래서 지웠습니다.
      }
    });

    await faceMesh.initialize(); await pose.initialize();
    
    if (videoRef.current) {
      cameraRef.current = new SafeCamera(videoRef.current, {
        onFrame: async () => { if (videoRef.current) { await pose.send({ image: videoRef.current }); await faceMesh.send({ image: videoRef.current }); } }, 
        width: 640, height: 480
      });
      cameraRef.current.start();
    }
  };

  // ==========================================
  // 4. 측정 종료(정리) 로직
  // ==========================================
  const stopCamera = () => {
    if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
    if (videoRef.current?.srcObject) { videoRef.current.srcObject.getTracks().forEach(t => t.stop()); videoRef.current.srcObject = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (poseRef.current) { poseRef.current.close(); poseRef.current = null; }
    if (faceMeshRef.current) { faceMeshRef.current.close(); faceMeshRef.current = null; }
    setEngineResult(null);
    setServerFeedback("측정을 시작하려면 상단의 '▶ 측정 시작' 버튼을 눌러주세요.");
    setServerStatus('--');
  };

  // ==========================================
  // 5. 화면(UI) 렌더링
  // ==========================================
  return (
    <div className="w-full bg-[#Eef2f6] min-h-[90vh] p-6 lg:p-10 animate-fade-in font-sans">
      
      {/* 상단 제목 및 조작 버튼 */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Focus Analysis Dashboard</h2>
        <div className="flex gap-3">
          <button onClick={() => { if (!isFocusing) { setIsFocusing(true); setFocusSeconds(0); resetStaticTracking(); setHistoryLog([]); startCamera(); } else { setIsFocusing(false); stopCamera(); } }} 
            className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${isFocusing ? 'bg-white text-rose-500 border border-rose-100 hover:bg-rose-50' : 'bg-[#5B44F2] text-white hover:bg-[#4a36c4]'}`}>
            {isFocusing ? '■ 측정 종료' : '▶ 측정 시작'}
          </button>
          {isFocusing && <button onClick={() => { needsCalibrationRef.current = true; alert("영점 조절 완료!"); }} className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-colors">🎯 영점 조절</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 좌측 패널: 진행 시간, 몰입 에너지, 소음 수치 표시 */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="flex flex-col gap-10 h-full justify-center p-8 py-12">
            <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100 pb-3">Session Metrics</h3>
            <div className="flex items-center gap-3 xl:gap-5">
              <div className="w-12 h-12 xl:w-14 xl:h-14 shrink-0 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner"><svg className="w-6 h-6 xl:w-7 xl:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
              <div className="min-w-0"><p className="text-xs font-bold text-slate-400 mb-1 truncate">진행 시간</p><p className="text-2xl sm:text-3xl xl:text-4xl font-black font-mono text-slate-900 leading-none tracking-tighter truncate">{formatTime(focusSeconds)}</p></div>
            </div>
            <div className="flex items-center gap-3 xl:gap-5">
              <div className="w-12 h-12 xl:w-14 xl:h-14 shrink-0 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner"><svg className="w-6 h-6 xl:w-7 xl:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.334.334a1 1 0 01-.707.293H9.414a1 1 0 01-.707-.293l-.334-.334z"></path></svg></div>
              <div className="min-w-0"><p className="text-xs font-bold text-slate-400 mb-1 truncate">몰입 에너지</p><p className="text-2xl sm:text-3xl xl:text-4xl font-black text-slate-900 leading-none truncate">{isFocusing ? (serverStatus === 'NORMAL' ? '96' : serverStatus === 'CAUTION' ? '72' : '45') : '--'}<span className="text-sm xl:text-lg opacity-40 ml-1">%</span></p></div>
            </div>
            <div className="flex items-center gap-3 xl:gap-5">
              <div className="w-12 h-12 xl:w-14 xl:h-14 shrink-0 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner"><svg className="w-6 h-6 xl:w-7 xl:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg></div>
              <div className="min-w-0"><p className="text-xs font-bold text-slate-400 mb-1 truncate">환경 소음</p><p className="text-2xl sm:text-3xl xl:text-4xl font-black text-slate-900 leading-none truncate">{decibel}<span className="text-sm xl:text-lg opacity-40 ml-1">dB</span></p></div>
            </div>
          </Card>
        </div>

        {/* 중앙 패널: 카메라 스트리밍 화면 */}
        <div className="lg:col-span-6 flex flex-col">
          <Card className="flex-grow p-4 bg-white relative overflow-hidden flex flex-col shadow-inner border-slate-200">
            <h3 className="font-bold text-slate-800 text-lg mb-4 px-2 tracking-tight">Live Analysis Video</h3>
            <div className="w-full flex-grow bg-slate-900 rounded-2xl relative overflow-hidden shadow-2xl">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-90" />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100 z-10" width="640" height="480" />
              {!isFocusing && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20 text-white font-bold tracking-widest text-sm">카메라 대기 중</div>}
              {isFocusing && !engineResult && <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-20 text-white"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div><p className="font-bold text-sm tracking-widest">AI MODEL LOADING...</p></div>}
              {isFocusing && engineResult && <div className="absolute top-4 right-4 bg-black/50 px-3 py-1.5 rounded-md flex items-center gap-2 z-20 text-white text-xs font-bold"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>LIVE</div>}
            </div>
          </Card>
        </div>

        {/* 우측 패널: 서버 AI 코칭 피드백 표시 */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <Card className="flex-1 flex flex-col items-center justify-center p-10 bg-slate-900 border-none text-white shadow-2xl">
             <h3 className="font-bold text-indigo-400 text-xs uppercase tracking-widest mb-10 border-b border-indigo-900/50 w-full text-center pb-4">Status & Insights</h3>
             <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-8 border-4 transition-all duration-500 ${serverStatus === 'WARNING' ? 'border-rose-500 text-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]' : serverStatus === 'CAUTION' ? 'border-amber-500 text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'border-emerald-500 text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]'}`}>
                <span className="font-black text-2xl tracking-tighter">{serverStatus}</span>
             </div>
             {/* 서버가 보내준 실제 코칭 메시지 텍스트 출력 */}
             <p className="text-center font-bold text-slate-300 mb-10 break-keep text-sm leading-relaxed">{serverFeedback}</p>
             <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div style={{width: `${decibel}%`}} className={`h-full transition-all duration-300 ${decibel > 65 ? 'bg-rose-500' : 'bg-[#5B44F2]'}`}></div>
             </div>
          </Card>
        </div>
      </div>

      {/* 하단 패널: 누적 히스토리 표 */}
      <Card className="mt-8 p-0 overflow-hidden shadow-xl border-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase tracking-wider">
            <tr><th className="p-5 pl-10">Time (detected_at)</th><th className="p-5">Status (pose_status)</th><th className="p-5">Score (imm_score)</th><th className="p-5">Noise (decibel)</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historyLog.length === 0 ? (<tr><td colSpan="4" className="p-16 text-center text-slate-400 font-black tracking-widest text-lg opacity-40 uppercase">No Data Tracked</td></tr>) : (
              historyLog.map((log, i) => (
                <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="p-5 pl-10 text-slate-500 font-mono font-bold text-xs">{log.detected_at}</td>
                  <td className="p-5"><span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tighter ${log.pose_status === 'WARNING' ? 'bg-rose-100 text-rose-600' : log.pose_status === 'CAUTION' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>{log.pose_status === 'WARNING' ? '⚠️ WARNING' : log.pose_status === 'CAUTION' ? '🟡 CAUTION' : '✅ NORMAL'}</span></td>
                  <td className="p-5 font-black text-slate-900">{log.imm_score}</td><td className="p-5 text-slate-400 font-bold">{log.decibel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}