import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { immersionApi } from '../shared/api';

/**
 * 실시간 집중도 트래킹 및 HUD 스켈레톤 대시보드
 * - [수정완료] 소켓 서버 주소를 .env 환경변수(VITE_API_URL) 기반으로 동적 할당
 * - 척추 중심선 및 얼굴 윤곽 하이테크 스켈레톤 구현
 */
export default function Dashboard() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const audioContextRef = useRef(null);
  const poseRef = useRef(null);
  const faceMeshRef = useRef(null);

  const socketRef = useRef(null);
  const faceLandmarksRef = useRef(null);
  const decibelRef = useRef(0);
  const calibrationRef = useRef(null);
  const needsCalibrationRef = useRef(false);
  const lastSentTimeRef = useRef(0);

  const [currentImmIdx, setCurrentImmIdx] = useState(null);
  const currentImmIdxRef = useRef(null);

  const [decibel, setDecibel] = useState(0);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [historyLog, setHistoryLog] = useState([]);

  const [calibrationCountdown, setCalibrationCountdown] = useState(null);
  const [calibrationFlash, setCalibrationFlash] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [serverFeedback, setServerFeedback] = useState("우측 상단의 '▶ 측정 시작' 버튼을 눌러주세요.");
  const [serverStatus, setServerStatus] = useState('--');
  const [displayScore, setDisplayScore] = useState('--');

  useEffect(() => {
    // 하드코딩 제거: 운영 서버 배포 시 소켓 연결 끊김 방지
    const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    socketRef.current = io(SOCKET_URL, { withCredentials: true });
    
    socketRef.current.on('analysis_result', (data) => {
      if (data.status === 'SUCCESS') {
        setIsEngineReady(true);
        let currentStatus = 'NORMAL';
        const backendPosture = data.posture_status || data.postureStatus || '';

        if (backendPosture.includes('_WARNING') || backendPosture === 'LEANING_ON_HAND') { currentStatus = 'WARNING'; }
        else if (backendPosture.includes('_CAUTION')) { currentStatus = 'CAUTION'; }
        
        if (calibrationCountdown === null && !isAnalyzing) setServerFeedback(data.message);
        setServerStatus(currentStatus);
        const finalScore = data.current_score || 0;
        setDisplayScore(finalScore);

        const time = new Date().toLocaleTimeString('ko-KR');
        setHistoryLog(prev => [{ detected_at: time, pose_status: currentStatus, imm_score: `${finalScore}%`, decibel: `${decibelRef.current} dB` }, ...prev].slice(0, 5));
      } else {
        if (!isAnalyzing) setServerFeedback(data.message);
      }
    });
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [calibrationCountdown, isAnalyzing]);

  useEffect(() => {
    let interval;
    if (isFocusing && !isAnalyzing) interval = setInterval(() => setFocusSeconds(p => p + 1), 1000);
    else clearInterval(interval);
    return () => clearInterval(interval);
  }, [isFocusing, isAnalyzing]);

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCalibrationRequest = () => {
    if (calibrationCountdown !== null || isAnalyzing) return;
    let timer = 3;
    setCalibrationCountdown(timer);
    setServerFeedback(`${timer}초 후 기준점을 설정합니다. 정면을 응시하세요.`);

    const countdownInterval = setInterval(() => {
      timer -= 1;
      if (timer > 0) {
        setCalibrationCountdown(timer);
        setServerFeedback(`${timer}초 후 기준점을 설정합니다. 정면을 응시하세요.`);
      } else {
        clearInterval(countdownInterval);
        setCalibrationCountdown(null);
        needsCalibrationRef.current = true;
        setServerFeedback("기준점 설정이 완료되었습니다.");
        
        setCalibrationFlash(true);
        setTimeout(() => setCalibrationFlash(false), 800);
      }
    }, 1000);
  };

  const startCamera = async () => {
    setServerFeedback("AI 분석 엔진을 준비 중입니다. 잠시만 기다려주세요...");
    const loadScript = (src) => new Promise((res) => { const s = document.createElement('script'); s.src = src; s.onload = res; document.body.appendChild(s); });
    if (!window.Pose) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
    if (!window.FaceMesh) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
    if (!window.Camera) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext(); audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser(); const source = audioCtx.createMediaStreamSource(stream); source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateDecibel = () => {
        if (!audioContextRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const currentDb = Math.round((dataArray.reduce((a, b) => a + b) / dataArray.length) * 1.5);
        decibelRef.current = currentDb;
        setDecibel(currentDb);
        requestAnimationFrame(updateDecibel);
      };
      updateDecibel();
    } catch (err) { console.error("마이크 오류", err); }

    const SafePose = window.Pose; const SafeCamera = window.Camera; const SafeFaceMesh = window.FaceMesh;
    const faceMesh = new SafeFaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    const pose = new SafePose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    faceMeshRef.current = faceMesh; poseRef.current = pose;

    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });
    faceMesh.onResults((res) => { faceLandmarksRef.current = res.multiFaceLandmarks?.[0] || null; });

    pose.onResults((res) => {
      if (!canvasRef.current || isAnalyzing) return;
      if (!res.poseLandmarks) {
        setServerFeedback("⚠️ 사용자를 찾을 수 없습니다! 상체가 잘 보이도록 정면을 향해 앉아주세요.");
        setServerStatus('--'); return;
      }
      
      const ctx = canvasRef.current.getContext('2d'); 
      ctx.save(); 
      ctx.clearRect(0, 0, 640, 480);
      
      const w = 640; 
      const h = 480;
      const p = res.poseLandmarks;

      /* 영점 조절 가이드라인 */
      if (calibrationRef.current && !needsCalibrationRef.current) {
        const { noseY, distY } = calibrationRef.current;
        const calibNoseY = noseY * h;
        const calibShoulderY = (noseY + distY) * h;

        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "rgba(52, 211, 153, 0.6)"; 
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(w * 0.15, calibNoseY); ctx.lineTo(w * 0.85, calibNoseY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w * 0.1, calibShoulderY); ctx.lineTo(w * 0.9, calibShoulderY); ctx.stroke();
        ctx.setLineDash([]); 
      }

      /* 인체 공학적 하이테크 HUD 스켈레톤 */
      if (p[11] && p[12] && p[0]) {
        ctx.strokeStyle = "rgba(99, 102, 241, 0.7)"; 
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p[11].x * w, p[11].y * h);
        ctx.lineTo(p[12].x * w, p[12].y * h);
        ctx.stroke();

        const neckX = (p[11].x + p[12].x) / 2 * w;
        const neckY = (p[11].y + p[12].y) / 2 * h;
        
        ctx.strokeStyle = "rgba(56, 189, 248, 0.9)"; 
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]); 
        ctx.beginPath();
        ctx.moveTo(neckX, neckY);
        ctx.lineTo(p[0].x * w, p[0].y * h);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = "rgba(129, 140, 248, 0.5)"; 
      ctx.lineWidth = 2;
      const faceConns = [
        [0, 1], [1, 2], [2, 3], [3, 7], 
        [0, 4], [4, 5], [5, 6], [6, 8]  
      ];
      ctx.beginPath();
      faceConns.forEach(([i, j]) => {
        if (p[i] && p[j]) {
          ctx.moveTo(p[i].x * w, p[i].y * h);
          ctx.lineTo(p[j].x * w, p[j].y * h);
        }
      });
      ctx.stroke();

      p.forEach((pt, i) => {
        if (i > 12) return; 
        ctx.beginPath(); 
        ctx.arc(pt.x * w, pt.y * h, i === 0 ? 5 : 3.5, 0, 2 * Math.PI); 
        ctx.fillStyle = "#ffffff"; 
        ctx.fill(); 
        ctx.lineWidth = 2;
        ctx.strokeStyle = i === 0 ? "#38BDF8" : (i === 11 || i === 12) ? "#818CF8" : "#A78BFA";
        ctx.stroke(); 
      }); 
      
      ctx.restore();

      if (needsCalibrationRef.current) {
        const leftEar = res.poseLandmarks[7] || { x: 0, y: 0 }; const leftShoulder = res.poseLandmarks[11] || { x: 0, y: 0 }; const nose = res.poseLandmarks[0] || { x: 0, y: 0 }; const rightEar = res.poseLandmarks[8] || { x: 0, y: 0 };
        calibrationRef.current = { distY: Math.abs(leftEar.y - leftShoulder.y), noseY: nose.y, earX: leftEar.x, sideDistX: Math.abs(leftEar.x - leftShoulder.x) * 640, baseEarDist: Math.abs(leftEar.x - rightEar.x) * 640 };
        needsCalibrationRef.current = false;
      }

      const now = Date.now();
      if (now - lastSentTimeRef.current >= 1000) {
        lastSentTimeRef.current = now;
        if (socketRef.current) socketRef.current.emit('stream_data', { imm_idx: currentImmIdxRef.current, landmarks: res.poseLandmarks, noise_db: decibelRef.current, calibration: calibrationRef.current, faceLandmarks: faceLandmarksRef.current });
      }
    });

    await faceMesh.initialize(); await pose.initialize();
    if (videoRef.current) {
      cameraRef.current = new SafeCamera(videoRef.current, { onFrame: async () => { if (videoRef.current && poseRef.current && faceMeshRef.current && !isAnalyzing) { try { await poseRef.current.send({ image: videoRef.current }); await faceMeshRef.current.send({ image: videoRef.current }); } catch (err) { } } }, width: 640, height: 480 });
      cameraRef.current.start();
    }
  };

  const stopCamera = () => {
    if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
    if (videoRef.current?.srcObject) { videoRef.current.srcObject.getTracks().forEach(t => t.stop()); videoRef.current.srcObject = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (poseRef.current) { poseRef.current.close(); poseRef.current = null; }
    if (faceMeshRef.current) { faceMeshRef.current.close(); faceMeshRef.current = null; }
    setIsEngineReady(false); setServerFeedback("우측 상단의 '▶ 측정 시작' 버튼을 눌러주세요."); setServerStatus('--'); setDisplayScore('--');
  };

  const handleStartMeasurement = async () => {
    try {
      const userInfoStr = localStorage.getItem('user_info');
      if (!userInfoStr) { navigate('/login'); return; }
      const actualUserIdx = JSON.parse(userInfoStr).user_idx;
      const result = await immersionApi.start(actualUserIdx);
      if (result && result.success && result.data?.imm_idx) {
        setCurrentImmIdx(result.data.imm_idx); currentImmIdxRef.current = result.data.imm_idx;
        setIsFocusing(true); setFocusSeconds(0); setHistoryLog([]); startCamera();
      } else { alert("세션 시작에 실패했습니다."); }
    } catch (err) { alert("서버 통신 중 에러가 발생했습니다."); }
  };

  const handleStopMeasurement = async () => {
    if (!currentImmIdxRef.current) return;
    
    setIsAnalyzing(true);
    setServerFeedback("AI가 전체 데이터를 종합하여 피드백을 생성하고 있습니다...");

    try {
      const finalScore = displayScore === '--' ? 0 : parseInt(displayScore, 10);
      const userInfoStr = localStorage.getItem('user_info');
      if (!userInfoStr) { navigate('/login'); return; }
      
      const result = await immersionApi.end({ imm_idx: currentImmIdxRef.current, imm_score: finalScore, user_idx: JSON.parse(userInfoStr).user_idx });
      
      if (result && result.success) { 
        setIsFocusing(false); 
        stopCamera();
        setIsAnalyzing(false);
        navigate(`/report/${currentImmIdxRef.current}`); 
      }
    } catch (err) { 
      console.error("측정 종료 에러:", err.message); 
      setIsAnalyzing(false);
      alert("종료 처리 중 오류가 발생했습니다.");
    }
  };

  const displayStatusLabel = serverStatus === 'WARNING' ? '위험' : serverStatus === 'CAUTION' ? '주의' : serverStatus === 'NORMAL' ? '정상' : '--';

  return (
    <div className="max-w-[1400px] mx-auto min-h-[90vh] p-6 lg:p-10 animate-fade-in font-sans selection:bg-indigo-100">
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-200/60">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">실시간 집중도 분석</h2>
          <p className="text-slate-500 mt-1 font-medium">AI가 사용자의 집중 상태와 주변 환경을 정밀하게 분석합니다.</p>
        </div>
        <div className="flex gap-4 items-center">
          {isFocusing && !isAnalyzing && (
            <button
              onClick={handleCalibrationRequest}
              disabled={calibrationCountdown !== null}
              className="px-6 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-all hover:border-slate-300 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🎯 {calibrationCountdown !== null ? `설정 중 (${calibrationCountdown})` : '영점 조절'}
            </button>
          )}
          
          <button
            onClick={isFocusing ? handleStopMeasurement : handleStartMeasurement}
            disabled={isAnalyzing}
            className={`px-10 py-3.5 rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center gap-2 
              ${isAnalyzing ? 'bg-slate-800 text-white shadow-none cursor-wait' : 
                isFocusing ? 'bg-white text-rose-600 border border-rose-100 hover:bg-rose-50 shadow-rose-100' : 
                'bg-[#5B44F2] text-white hover:bg-[#4a36c4] shadow-indigo-100'}`}
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                피드백 생성 중...
              </span>
            ) : isFocusing ? '■ 측정 종료' : '▶ 측정 시작'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: '진행 시간', value: formatTime(focusSeconds), unit: '', icon: '⏱️', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
            { label: '집중 에너지', value: displayScore, unit: '%', icon: '⚡', color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
            { label: '주변 소음', value: decibel, unit: 'dB', icon: '🎧', color: 'text-slate-500', bgColor: 'bg-slate-100' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white rounded-3xl p-7 border border-slate-100 shadow-sm flex items-center gap-6 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/50 hover:-translate-y-1">
              <div className={`w-16 h-16 rounded-full ${item.bgColor} flex items-center justify-center text-3xl border border-white/50 shadow-inner ${item.color}`}>{item.icon}</div>
              <div>
                <p className="text-sm font-semibold text-slate-400 mb-1.5">{item.label}</p>
                <p className={`text-4xl font-black tracking-tight leading-none ${idx === 0 ? 'font-mono' : ''} text-slate-900`}>{item.value}<span className="text-xl text-slate-400 font-bold ml-1.5">{item.unit}</span></p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col h-full">
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex-grow transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/50">
              <div className="flex justify-between items-center mb-5 px-1">
                <h3 className="font-bold text-slate-900 text-lg tracking-tight">실시간 AI 비전 분석</h3>
                {isFocusing && isEngineReady && !isAnalyzing && <div className="bg-slate-50 px-3.5 py-1.5 rounded-full flex items-center gap-2 text-slate-500 text-xs font-bold border border-slate-100 shadow-sm"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>AI 분석 활성화됨</div>}
              </div>

              <style>{`
                @keyframes laser-scan {
                  0% { top: -10%; opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; }
                  100% { top: 100%; opacity: 0; }
                }
                .animate-laser { animation: laser-scan 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
              `}</style>

              <div className="w-full aspect-[4/3] bg-slate-950 rounded-2xl relative overflow-hidden shadow-2xl shadow-slate-200 border border-slate-800">
                
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-95" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100 z-10" width="640" height="480" />

                {isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50 text-white gap-6 animate-fade-in">
                    <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                    <div className="text-center">
                      <h3 className="text-2xl font-black mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 animate-pulse">AI 리포트 생성 중...</h3>
                      <p className="text-sm font-semibold text-slate-300 leading-relaxed">자세 및 소음 데이터를 바탕으로<br/>맞춤형 피드백을 생성하고 있습니다.</p>
                    </div>
                  </div>
                )}

                {calibrationCountdown !== null && !isAnalyzing && (
                  <div className="absolute inset-0 z-30 pointer-events-none">
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] transition-all"></div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-40">
                      <div className="w-64 h-64 border-[1.5px] border-emerald-400 rounded-full"></div>
                      <div className="absolute w-72 h-[1px] bg-emerald-400"></div>
                      <div className="absolute h-72 w-[1px] bg-emerald-400"></div>
                    </div>
                    <div className="absolute left-0 w-full h-[3px] bg-emerald-400 shadow-[0_0_25px_8px_rgba(52,211,153,0.8)] animate-laser z-40">
                       <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-400/20 to-transparent"></div>
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50">
                      <div className="text-[120px] leading-none font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-600 animate-pulse drop-shadow-[0_0_30px_rgba(52,211,153,0.8)] mb-2">
                        {calibrationCountdown}
                      </div>
                      <p className="text-emerald-300 text-xl font-black tracking-[0.3em] uppercase drop-shadow-md">AI Precision Scanning</p>
                      <p className="text-emerald-100/70 text-sm mt-3 tracking-wide font-medium">정면을 응시하고 자세를 유지해 주세요</p>
                    </div>
                  </div>
                )}

                <div className={`absolute inset-0 z-40 bg-emerald-400 mix-blend-overlay pointer-events-none transition-all duration-700 ease-out ${calibrationFlash && !isAnalyzing ? 'opacity-70 scale-105' : 'opacity-0 scale-100'}`}></div>

                {!isFocusing && !isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 text-white gap-4">
                    <p className="font-bold tracking-wider text-sm text-slate-300">카메라 대기 중... '측정 시작'을 눌러주세요.</p>
                  </div>
                )}
                {isFocusing && !isEngineReady && !isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 text-white gap-5">
                    <div className="w-12 h-12 border-4 border-[#5B44F2] border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-bold text-sm tracking-widest text-slate-200">AI 모델 데이터를 불러오는 중...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="p-8 py-10 rounded-[1.75rem] bg-slate-950 text-white shadow-2xl shadow-slate-300 flex flex-col items-center text-center flex-grow relative overflow-hidden transition-all duration-300 hover:shadow-indigo-300/30">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#5B44F2]/20 rounded-full blur-3xl pointer-events-none"></div>
              <h3 className="font-bold text-indigo-300 text-xs uppercase tracking-widest mb-12 border-b border-indigo-900/50 w-full pb-4 relative z-10">현재 집중 상태</h3>

              <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-10 border-8 transition-all duration-500 relative z-10 ${serverStatus === 'WARNING' ? 'border-rose-600 shadow-[0_0_40px_rgba(225,29,72,0.4)]' : serverStatus === 'CAUTION' ? 'border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.4)]' : serverStatus === 'NORMAL' ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]' : 'border-slate-700'}`}>
                {isFocusing && !isAnalyzing && <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${serverStatus === 'WARNING' ? 'bg-rose-600' : serverStatus === 'CAUTION' ? 'bg-amber-500' : serverStatus === 'NORMAL' ? 'bg-emerald-500' : ''}`}></div>}
                <span className="font-black text-3xl tracking-tighter z-10 drop-shadow-md">{isAnalyzing ? '...' : displayStatusLabel}</span>
              </div>

              <p className="font-bold text-slate-200 mb-12 break-keep text-base leading-relaxed max-w-[280px] min-h-[56px] flex items-center justify-center relative z-10">
                {serverFeedback}
              </p>

              <div className="w-full mt-auto relative z-10">
                <div className="flex justify-between items-center mb-2 text-xs font-semibold text-slate-400">
                  <span>현재 소음 수준 (dB)</span>
                  <span className={decibel > 65 ? 'text-rose-400' : 'text-slate-400'}>{decibel} / 100</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                  <div style={{ width: `${Math.min(100, decibel)}%` }} className={`h-full transition-all duration-300 rounded-full ${decibel > 65 ? 'bg-rose-500' : 'bg-[#5B44F2]'}`}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-2 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/50">
          <div className="p-6 px-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <h3 className="font-bold text-slate-900 text-lg tracking-tight">실시간 데이터 기록</h3>
            <p className="text-slate-400 text-sm font-medium">가장 최근 측정된 5건의 데이터 표기</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="p-5 pl-8">측정 시간</th><th className="p-5">자세 상태</th><th className="p-5">집중도</th><th className="p-5">주변 소음 (dB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyLog.length === 0 ? (
                <tr><td colSpan="4" className="p-20 text-center"><div className="text-6xl mb-5 opacity-30">📊</div><p className="text-slate-400 font-bold tracking-widest text-lg opacity-60">측정된 데이터가 없습니다</p></td></tr>
              ) : (
                historyLog.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-5 pl-8 text-slate-600 font-mono font-bold text-xs">{log.detected_at}</td>
                    <td className="p-5">
                      <span className={`px-3.5 py-1.5 rounded-full text-[12px] font-black tracking-tighter inline-flex items-center gap-1.5 shadow-sm ${log.pose_status === 'WARNING' ? 'bg-rose-50 text-rose-700 border border-rose-100' : log.pose_status === 'CAUTION' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shadow-inner ${log.pose_status === 'WARNING' ? 'bg-rose-500' : log.pose_status === 'CAUTION' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        {log.pose_status === 'WARNING' ? '위험' : log.pose_status === 'CAUTION' ? '주의' : '정상'}
                      </span>
                    </td>
                    <td className="p-5 font-black text-slate-900 text-base">{log.imm_score}</td>
                    <td className="p-5 text-slate-500 font-bold">{log.decibel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}