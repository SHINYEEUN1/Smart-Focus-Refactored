import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

/* FSD 아키텍처 규격에 따른 API 모듈 임포트 */
import { immersionApi } from '../shared/api';

/**
 * 실시간 AI 비전 분석 및 집중도 측정 대시보드 컴포넌트
 */
export default function Dashboard() {
  const navigate = useNavigate();

  /* 미디어 장치 및 분석 엔진 참조를 위한 Ref 선언 */
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const audioContextRef = useRef(null);
  const poseRef = useRef(null);
  const faceMeshRef = useRef(null);

  /* 실시간 데이터 통신 및 캘리브레이션 관리를 위한 Ref 선언 */
  const socketRef = useRef(null);
  const faceLandmarksRef = useRef(null);
  const decibelRef = useRef(0);
  const calibrationRef = useRef(null);
  const needsCalibrationRef = useRef(false);
  const lastSentTimeRef = useRef(0);

  /* 세션 식별자 및 UI 상태 관리 */
  const [currentImmIdx, setCurrentImmIdx] = useState(null);
  const currentImmIdxRef = useRef(null);

  const [decibel, setDecibel] = useState(0);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false); 
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [historyLog, setHistoryLog] = useState([]);

  /* 영점 조절 카운트다운 상태 */
  const [calibrationCountdown, setCalibrationCountdown] = useState(null);

  /* 서버 피드백 및 상태 표시 관리 */
  const [serverFeedback, setServerFeedback] = useState("우측 상단의 '▶ 측정 시작' 버튼을 눌러주세요.");
  const [serverStatus, setServerStatus] = useState('--');
  const [displayScore, setDisplayScore] = useState('--');

  /**
   * 소켓 통신 초기화 및 서버 분석 결과 수신 핸들러
   */
  useEffect(() => {
    socketRef.current = io('http://localhost:3000', { withCredentials: true });

    socketRef.current.on('analysis_result', (data) => {
      if (data.status === 'SUCCESS') {
        setIsEngineReady(true); 
        
        let currentStatus = 'NORMAL';
        const backendPosture = data.posture_status || data.postureStatus || '';

        if (backendPosture.includes('_WARNING') || backendPosture === 'LEANING_ON_HAND') {
          currentStatus = 'WARNING';
        } 
        else if (backendPosture.includes('_CAUTION')) {
          currentStatus = 'CAUTION';
        } 
        else {
          currentStatus = 'NORMAL';
        }

        if (calibrationCountdown === null) {
          setServerFeedback(data.message);
        }
        setServerStatus(currentStatus);

        const finalScore = data.current_score || 0; 
        setDisplayScore(finalScore);

        const time = new Date().toLocaleTimeString('ko-KR');
        setHistoryLog(prev => [{
          detected_at: time,
          pose_status: currentStatus,
          imm_score: `${finalScore}%`,
          decibel: `${decibelRef.current} dB`
        }, ...prev].slice(0, 5));

      } else {
        setServerFeedback(data.message);
      }
    });

    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [calibrationCountdown]);

  /**
   * 측정 진행 시간 카운터 로직
   */
  useEffect(() => {
    let interval;
    if (isFocusing) interval = setInterval(() => setFocusSeconds(p => p + 1), 1000);
    else clearInterval(interval);
    return () => clearInterval(interval);
  }, [isFocusing]);

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  /**
   * 영점 조절(캘리브레이션) 핸들러
   */
  const handleCalibrationRequest = () => {
    if (calibrationCountdown !== null) return;

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
      }
    }, 1000);
  };

  /**
   * 미디어 파이프 분석 엔진 및 카메라 구동 로직
   */
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
      if (!canvasRef.current) return;

      if (!res.poseLandmarks) {
        setServerFeedback("⚠️ 사용자를 찾을 수 없습니다! 상체가 잘 보이도록 정면을 향해 앉아주세요.");
        setServerStatus('--');
        return;
      }

      const ctx = canvasRef.current.getContext('2d'); ctx.save(); ctx.clearRect(0, 0, 640, 480);
      ctx.strokeStyle = "rgba(234, 255, 113, 0.8)"; ctx.lineWidth = 2;
      res.poseLandmarks.forEach(p => { ctx.beginPath(); ctx.arc(p.x * 640, p.y * 480, 3, 0, 2 * Math.PI); ctx.fillStyle = "#D9F99D"; ctx.fill(); ctx.stroke(); }); ctx.restore();

      if (needsCalibrationRef.current) { 
        const leftEar = res.poseLandmarks[7] || { x: 0, y: 0 };
        const leftShoulder = res.poseLandmarks[11] || { x: 0, y: 0 };
        const nose = res.poseLandmarks[0] || { x: 0, y: 0 };

        calibrationRef.current = { 
          distY: Math.abs(leftEar.y - leftShoulder.y),
          noseY: nose.y,
          earX: leftEar.x,
          sideDistX: Math.abs(leftEar.x - leftShoulder.x) * 640 
        }; 
        needsCalibrationRef.current = false; 
      }

      const now = Date.now();
      if (now - lastSentTimeRef.current >= 1000) {
        lastSentTimeRef.current = now;
        
        if (socketRef.current) {
          socketRef.current.emit('stream_data', { 
            imm_idx: currentImmIdxRef.current, 
            landmarks: res.poseLandmarks, 
            noise_db: decibelRef.current,
            calibration: calibrationRef.current,
            faceLandmarks: faceLandmarksRef.current
          });
        }
      }
    });

    await faceMesh.initialize(); await pose.initialize();

    if (videoRef.current) {
      cameraRef.current = new SafeCamera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && poseRef.current && faceMeshRef.current) {
            try {
              await poseRef.current.send({ image: videoRef.current });
              await faceMeshRef.current.send({ image: videoRef.current });
            } catch (err) { }
          }
        },
        width: 640, height: 480
      });
      cameraRef.current.start();
    }
  };

  /**
   * 장치 연결 해제 및 리소스 클린업
   */
  const stopCamera = () => {
    if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
    if (videoRef.current?.srcObject) { videoRef.current.srcObject.getTracks().forEach(t => t.stop()); videoRef.current.srcObject = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (poseRef.current) { poseRef.current.close(); poseRef.current = null; }
    if (faceMeshRef.current) { faceMeshRef.current.close(); faceMeshRef.current = null; }
    
    setIsEngineReady(false);
    setServerFeedback("우측 상단의 '▶ 측정 시작' 버튼을 눌러주세요.");
    setServerStatus('--');
    setDisplayScore('--');
  };

  /**
   * 측정 시작 핸들러
   */
  const handleStartMeasurement = async () => {
    try {
      const userInfoStr = localStorage.getItem('user_info');
      if (!userInfoStr) {
        alert("로그인 정보가 없습니다. 다시 로그인 해주세요.");
        navigate('/login');
        return;
      }
      const actualUserIdx = JSON.parse(userInfoStr).user_idx;
      const result = await immersionApi.start(actualUserIdx);

      if (result && result.success && result.data?.imm_idx) {
        const immIdx = result.data.imm_idx;
        setCurrentImmIdx(immIdx);
        currentImmIdxRef.current = immIdx; 

        setIsFocusing(true);
        setFocusSeconds(0);
        setHistoryLog([]);
        startCamera();
      } else {
        alert(result?.message || "세션 시작에 실패했습니다.");
      }
    } catch (err) {
      console.error("측정 시작 에러:", err.message);
      alert("서버 통신 중 에러가 발생했습니다.");
    }
  };

  /**
   * 측정 종료 핸들러
   */
  const handleStopMeasurement = async () => {
    setIsFocusing(false);
    stopCamera();

    if (!currentImmIdxRef.current) {
      alert("진행 중인 세션 정보를 찾을 수 없습니다.");
      return;
    }

    try {
      const finalScore = displayScore === '--' ? 0 : parseInt(displayScore, 10);
      const userInfoStr = localStorage.getItem('user_info');
      if (!userInfoStr) {
        alert("세션이 만료되었습니다.");
        navigate('/login');
        return;
      }
      const actualUserIdx = JSON.parse(userInfoStr).user_idx;

      const result = await immersionApi.end({
        imm_idx: currentImmIdxRef.current,
        imm_score: finalScore,
        user_idx: actualUserIdx 
      });

      if (result && result.success) {
        alert("집중 수고하셨습니다! 분석 리포트로 이동합니다.");
        navigate(`/report/${currentImmIdxRef.current}`);
      } else {
        alert(result?.message || "측정 기록 저장에 실패했습니다.");
      }
    } catch (err) {
      console.error("측정 종료 에러:", err.message);
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
          {isFocusing && (
            <button
              onClick={handleCalibrationRequest}
              disabled={calibrationCountdown !== null}
              className="px-6 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-all hover:border-slate-300 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🎯 {calibrationCountdown !== null ? `설정 중 (${calibrationCountdown})` : '영점 조절'}
            </button>
          )}
          {/* 강제 Hex 컬러 코드를 사용하여 CSS 변수 파싱 에러 완벽 차단 */}
          <button
            onClick={isFocusing ? handleStopMeasurement : handleStartMeasurement}
            className={`px-10 py-3.5 rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center gap-2 ${isFocusing
              ? 'bg-white text-rose-600 border border-rose-100 hover:bg-rose-50 shadow-rose-100'
              : 'bg-[#5B44F2] text-white hover:bg-[#4a36c4] shadow-indigo-100'
              }`}
          >
            {isFocusing ? '■ 측정 종료' : '▶ 측정 시작'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* 상단 스태츠 카드 영역: 순수 Tailwind 클래스로 배경, 패딩 복구 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: '진행 시간', value: formatTime(focusSeconds), unit: '', icon: '⏱️', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
            { label: '집중 에너지', value: displayScore, unit: '%', icon: '⚡', color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
            { label: '주변 소음', value: decibel, unit: 'dB', icon: '🎧', color: 'text-slate-500', bgColor: 'bg-slate-100' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white rounded-3xl p-7 border border-slate-100 shadow-sm flex items-center gap-6 transition-all hover:shadow-md hover:-translate-y-1">
              <div className={`w-16 h-16 rounded-full ${item.bgColor} flex items-center justify-center text-3xl border border-white/50 shadow-inner ${item.color}`}>
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-400 mb-1.5">{item.label}</p>
                <p className={`text-4xl font-black tracking-tight leading-none ${idx === 0 ? 'font-mono' : ''} text-slate-900`}>
                  {item.value}<span className="text-xl text-slate-400 font-bold ml-1.5">{item.unit}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col h-full">
            {/* 카메라 컨테이너: 배경, 패딩 명시적으로 롤백 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex-grow">
              <div className="flex justify-between items-center mb-5 px-1">
                <h3 className="font-bold text-slate-900 text-lg tracking-tight">실시간 AI 비전 분석</h3>
                {isFocusing && isEngineReady && <div className="bg-slate-50 px-3.5 py-1.5 rounded-full flex items-center gap-2 text-slate-500 text-xs font-bold border border-slate-100"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>AI 분석 활성화됨</div>}
              </div>

              <div className="w-full aspect-[4/3] bg-slate-950 rounded-2xl relative overflow-hidden shadow-2xl shadow-slate-200">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-95" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100 z-10" width="640" height="480" />

                {calibrationCountdown !== null && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                    <div className="text-8xl font-black text-white animate-pulse mb-4">{calibrationCountdown}</div>
                    <p className="text-white text-xl font-bold tracking-tight">정면을 유지해 주세요</p>
                  </div>
                )}

                {!isFocusing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 text-white gap-4">
                    <div className="text-6xl"></div>
                    <p className="font-bold tracking-wider text-sm text-slate-300">카메라 대기 중... '측정 시작'을 눌러주세요.</p>
                  </div>
                )}
                {isFocusing && !isEngineReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 text-white gap-5">
                    <div className="w-12 h-12 border-4 border-[#5B44F2] border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-bold text-sm tracking-widest text-slate-200">AI 모델 데이터를 불러오는 중...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="p-8 py-10 rounded-[1.75rem] bg-slate-950 text-white shadow-2xl shadow-slate-300 flex flex-col items-center text-center flex-grow">
              <h3 className="font-bold text-indigo-300 text-xs uppercase tracking-widest mb-12 border-b border-indigo-900/50 w-full pb-4">현재 집중 상태</h3>

              <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-10 border-8 transition-all duration-500 relative ${serverStatus === 'WARNING' ? 'border-rose-600 shadow-[0_0_40px_rgba(225,29,72,0.4)]' :
                serverStatus === 'CAUTION' ? 'border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.4)]' :
                  serverStatus === 'NORMAL' ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]' :
                    'border-slate-700'
                }`}>
                {isFocusing && <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${serverStatus === 'WARNING' ? 'bg-rose-600' : serverStatus === 'CAUTION' ? 'bg-amber-500' : serverStatus === 'NORMAL' ? 'bg-emerald-500' : ''}`}></div>}
                <span className="font-black text-3xl tracking-tighter z-10">{displayStatusLabel}</span>
              </div>

              <p className="font-bold text-slate-200 mb-12 break-keep text-base leading-relaxed max-w-[280px] min-h-[56px] flex items-center justify-center">
                {serverFeedback}
              </p>

              <div className="w-full mt-auto">
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

        {/* 데이터 테이블 영역: 배경 복구 */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-2">
          <div className="p-6 px-8 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-lg tracking-tight">실시간 데이터 기록</h3>
            <p className="text-slate-400 text-sm font-medium">가장 최근에 측정된 5건의 데이터가 표시됩니다.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="p-5 pl-8">측정 시간</th>
                <th className="p-5">자세 상태</th>
                <th className="p-5">집중도</th>
                <th className="p-5">주변 소음 (dB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyLog.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-20 text-center">
                    <div className="text-6xl mb-5 opacity-30">📊</div>
                    <p className="text-slate-400 font-bold tracking-widest text-lg opacity-60">측정된 데이터가 없습니다</p>
                    <p className="text-slate-400 mt-1 font-medium">'측정 시작' 버튼을 눌러 분석을 시작하세요.</p>
                  </td>
                </tr>
              ) : (
                historyLog.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 pl-8 text-slate-600 font-mono font-bold text-xs">{log.detected_at}</td>
                    <td className="p-5">
                      <span className={`px-3.5 py-1.5 rounded-full text-[12px] font-black tracking-tighter inline-flex items-center gap-1.5 ${log.pose_status === 'WARNING' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                        log.pose_status === 'CAUTION' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${log.pose_status === 'WARNING' ? 'bg-rose-500' :
                          log.pose_status === 'CAUTION' ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`}></span>
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