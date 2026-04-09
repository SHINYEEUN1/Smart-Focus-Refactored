import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { immersionApi } from '../shared/api';

/**
 * [실시간 집중도 트래킹 및 HUD 대시보드]
 * - [Bug Fix] React Closure Trap 해결: pose.onResults 내부에서 최신 isFocusing 상태를 참조하도록 isFocusingRef 도입
 * - 다크모드 전역 테마 동기화 및 에러 방어 로직 완비
 * - [UX 개선] 영점 조절 클릭 시 카메라 선행 구동 (Live Calibration)
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
  
  // [Bug Fix] 상태(State)와 최신 참조(Ref)를 동시 관리하여 콜백 내부 지연(Stale) 현상 방지
  const [isFocusing, setIsFocusing] = useState(false);
  const isFocusingRef = useRef(false); 

  const [isEngineReady, setIsEngineReady] = useState(false);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [historyLog, setHistoryLog] = useState([]);

  const [cameraState, setCameraState] = useState('OFF');
  const [calibrationCountdown, setCalibrationCountdown] = useState(null);
  const [calibrationFlash, setCalibrationFlash] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [hasCalibrated, setHasCalibrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('hide_dashboard_guide') !== 'true');

  const [serverFeedback, setServerFeedback] = useState("우측 상단의 '🎯 영점 조절' 버튼을 눌러 카메라를 켜주세요.");
  const [serverStatus, setServerStatus] = useState('--');
  const [displayScore, setDisplayScore] = useState('--');

  const closeOnboarding = (neverShowAgain = false) => {
    if (neverShowAgain) localStorage.setItem('hide_dashboard_guide', 'true');
    setShowOnboarding(false);
  };

  // calibrationCountdown과 isAnalyzing을 Ref로 관리하여 소켓 리스너가 항상 최신 값을 참조하도록 한다.
  // 이유: useEffect 의존성 배열에 이 값들을 넣으면 소켓이 재연결될 때마다 리스너가 재등록되어
  //       분석 결과가 순간적으로 누락될 수 있다.
  const calibrationCountdownRef = useRef(null);
  const isAnalyzingRef = useRef(false);

  useEffect(() => { calibrationCountdownRef.current = calibrationCountdown; }, [calibrationCountdown]);
  useEffect(() => { isAnalyzingRef.current = isAnalyzing; }, [isAnalyzing]);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    socketRef.current = io(SOCKET_URL, { withCredentials: true });

    socketRef.current.on('analysis_result', (data) => {
      if (data.status === 'SUCCESS') {
        setIsEngineReady(true);
        let currentStatus = 'NORMAL';
        const backendPosture = data.posture_status || data.postureStatus || '';
        if (backendPosture.includes('_WARNING') || backendPosture === 'LEANING_ON_HAND') { currentStatus = 'WARNING'; }
        else if (backendPosture.includes('_CAUTION')) { currentStatus = 'CAUTION'; }

        if (calibrationCountdownRef.current === null && !isAnalyzingRef.current) setServerFeedback(data.message);
        setServerStatus(currentStatus);
        const finalScore = data.current_score || 0;
        setDisplayScore(finalScore);

        const time = new Date().toLocaleTimeString('ko-KR');
        setHistoryLog(prev => [{ detected_at: time, pose_status: currentStatus, imm_score: `${finalScore}%`, decibel: `${decibelRef.current} dB` }, ...prev].slice(0, 5));
      } else {
        if (!isAnalyzingRef.current) setServerFeedback(data.message);
      }
    });
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  useEffect(() => {
    let interval;
    if (isFocusing && !isAnalyzing) interval = setInterval(() => setFocusSeconds(prev => prev + 1), 1000);
    else clearInterval(interval);
    return () => clearInterval(interval);
  }, [isFocusing, isAnalyzing]);

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCalibrationRequest = async () => {
    if (calibrationCountdown !== null || isAnalyzing) return;

    if (cameraState === 'OFF') {
      setCameraState('STARTING');
      setServerFeedback("AI 분석 엔진과 카메라를 활성화하고 있습니다...");
      await startCamera();
      setCameraState('ON');
    }

    setServerFeedback("곧 영점 조절을 시작합니다. 화면을 보고 바른 자세를 잡아주세요.");
    
    setTimeout(() => {
      startCountdown();
    }, 2000);
  };

  const startCountdown = () => {
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
        setHasCalibrated(true);
        setServerFeedback("기준점 설정이 완료되었습니다. '▶ 측정 시작' 버튼을 눌러주세요.");
        setCalibrationFlash(true);
        setTimeout(() => setCalibrationFlash(false), 800);
      }
    }, 1000);
  };

  // MediaPipe 라이브러리를 CDN에서 동적으로 로드하는 헬퍼.
  // 빌드 번들에 포함하지 않는 이유: MediaPipe WASM 파일이 수십 MB에 달해
  // 초기 번들 크기를 과도하게 늘리기 때문이다.
  const loadMediaPipeScripts = async () => {
    const loadScript = (src) => new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      document.body.appendChild(script);
    });
    if (!window.Pose) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
    if (!window.FaceMesh) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
    if (!window.Camera) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
  };

  // 마이크 스트림을 열고 AudioContext로 실시간 데시벨을 측정한다.
  // requestAnimationFrame으로 매 프레임마다 갱신하여 소음 수치를 실시간으로 반영한다.
  const initAudioAnalyser = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
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
    } catch (err) {
      if (import.meta.env.DEV) console.error('[MICROPHONE ERROR]', err);
    }
  };

  // Pose와 FaceMesh 인스턴스를 초기화하고 카메라 루프를 시작한다.
  // FaceMesh 결과(faceLandmarksRef)는 Pose onResults 안에서 참조되어
  // 거북목/턱괴기 등 얼굴 랜드마크가 필요한 분석에 사용된다.
  // pose.onResults에서 isFocusingRef(Ref)를 참조하는 이유:
  // React closure 특성상 콜백 내부에서 isFocusing(State)은 등록 시점의 값으로 고정되지만,
  // Ref는 항상 최신 값을 참조하므로 측정 시작/종료 상태를 정확히 반영할 수 있다.
  const initPoseAndFaceMesh = async () => {
    const SafePose = window.Pose;
    const SafeCamera = window.Camera;
    const SafeFaceMesh = window.FaceMesh;

    const faceMesh = new SafeFaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    const pose = new SafePose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    faceMeshRef.current = faceMesh;
    poseRef.current = pose;

    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

    faceMesh.onResults((results) => {
      faceLandmarksRef.current = results.multiFaceLandmarks?.[0] || null;
    });

    pose.onResults((results) => {
      if (!canvasRef.current || isAnalyzing) return;
      if (!results.poseLandmarks) {
        setServerFeedback("⚠️ 사용자를 찾을 수 없습니다! 상체가 잘 보이도록 정면을 향해 앉아주세요.");
        setServerStatus('--');
        return;
      }

      const ctx = canvasRef.current.getContext('2d');
      ctx.save();
      ctx.clearRect(0, 0, 640, 480);
      const canvasWidth = 640;
      const canvasHeight = 480;
      const poseLandmarks = results.poseLandmarks;

      // 영점 조절 기준선을 캔버스에 그린다.
      // 사용자가 올바른 자세 기준점을 시각적으로 확인할 수 있도록 반투명 가이드라인을 표시한다.
      if (calibrationRef.current && !needsCalibrationRef.current) {
        const { noseY, distY } = calibrationRef.current;
        const calibNoseY = noseY * canvasHeight;
        const calibShoulderY = (noseY + distY) * canvasHeight;
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "rgba(52, 211, 153, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(canvasWidth * 0.15, calibNoseY); ctx.lineTo(canvasWidth * 0.85, calibNoseY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(canvasWidth * 0.1, calibShoulderY); ctx.lineTo(canvasWidth * 0.9, calibShoulderY); ctx.stroke();
        ctx.setLineDash([]);
      }

      // 어깨 연결선과 목선을 그린다.
      if (poseLandmarks[11] && poseLandmarks[12] && poseLandmarks[0]) {
        ctx.strokeStyle = "rgba(99, 102, 241, 0.7)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(poseLandmarks[11].x * canvasWidth, poseLandmarks[11].y * canvasHeight);
        ctx.lineTo(poseLandmarks[12].x * canvasWidth, poseLandmarks[12].y * canvasHeight);
        ctx.stroke();
        const neckX = (poseLandmarks[11].x + poseLandmarks[12].x) / 2 * canvasWidth;
        const neckY = (poseLandmarks[11].y + poseLandmarks[12].y) / 2 * canvasHeight;
        ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(neckX, neckY);
        ctx.lineTo(poseLandmarks[0].x * canvasWidth, poseLandmarks[0].y * canvasHeight);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 얼굴 연결선을 그린다.
      ctx.strokeStyle = "rgba(129, 140, 248, 0.5)";
      ctx.lineWidth = 2;
      const faceConns = [[0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8]];
      ctx.beginPath();
      faceConns.forEach(([i, j]) => {
        if (poseLandmarks[i] && poseLandmarks[j]) {
          ctx.moveTo(poseLandmarks[i].x * canvasWidth, poseLandmarks[i].y * canvasHeight);
          ctx.lineTo(poseLandmarks[j].x * canvasWidth, poseLandmarks[j].y * canvasHeight);
        }
      });
      ctx.stroke();

      // 랜드마크 점을 그린다 (코·어깨만 강조).
      poseLandmarks.forEach((point, i) => {
        if (i > 12) return;
        ctx.beginPath();
        ctx.arc(point.x * canvasWidth, point.y * canvasHeight, i === 0 ? 5 : 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = i === 0 ? "#38BDF8" : (i === 11 || i === 12) ? "#818CF8" : "#A78BFA";
        ctx.stroke();
      });
      ctx.restore();

      // needsCalibrationRef가 true이면 현재 프레임의 랜드마크로 기준값을 캡처한다.
      // 영점 조절 완료 시 단 한 번만 실행되며, 이후 false로 초기화된다.
      if (needsCalibrationRef.current) {
        const leftEar = results.poseLandmarks[7] || { x: 0, y: 0 };
        const leftShoulder = results.poseLandmarks[11] || { x: 0, y: 0 };
        const nose = results.poseLandmarks[0] || { x: 0, y: 0 };
        const rightEar = results.poseLandmarks[8] || { x: 0, y: 0 };
        calibrationRef.current = {
          distY: Math.abs(leftEar.y - leftShoulder.y),
          noseY: nose.y,
          earX: leftEar.x,
          sideDistX: Math.abs(leftEar.x - leftShoulder.x) * 640,
          baseEarDist: Math.abs(leftEar.x - rightEar.x) * 640
        };
        needsCalibrationRef.current = false;
      }

      // isFocusingRef(Ref)를 참조하여 정확한 전송 제어.
      // 1초에 한 번씩만 소켓으로 스트림 데이터를 전송한다.
      const now = Date.now();
      if (isFocusingRef.current && currentImmIdxRef.current && (now - lastSentTimeRef.current >= 1000)) {
        lastSentTimeRef.current = now;
        if (socketRef.current) {
          socketRef.current.emit('stream_data', {
            imm_idx: currentImmIdxRef.current,
            landmarks: results.poseLandmarks,
            noise_db: decibelRef.current,
            calibration: calibrationRef.current,
            faceLandmarks: faceLandmarksRef.current
          });
        }
      }
    });

    await faceMesh.initialize();
    await pose.initialize();

    if (videoRef.current) {
      cameraRef.current = new SafeCamera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && poseRef.current && faceMeshRef.current && !isAnalyzing) {
            try {
              await poseRef.current.send({ image: videoRef.current });
              await faceMeshRef.current.send({ image: videoRef.current });
            } catch (err) { /* 카메라 프레임 전송 실패는 무시하고 다음 프레임을 처리한다 */ }
          }
        },
        width: 640,
        height: 480
      });
      cameraRef.current.start();
    }
  };

  // startCamera는 세 단계를 순서대로 실행한다:
  // 1. MediaPipe 스크립트 CDN 로드
  // 2. 마이크 오디오 분석기 초기화
  // 3. Pose/FaceMesh 모델 초기화 및 카메라 루프 시작
  const startCamera = async () => {
    await loadMediaPipeScripts();
    await initAudioAnalyser();
    await initPoseAndFaceMesh();
  };

  const stopCamera = () => {
    if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
    if (videoRef.current?.srcObject) { videoRef.current.srcObject.getTracks().forEach(track => track.stop()); videoRef.current.srcObject = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (poseRef.current) { poseRef.current.close(); poseRef.current = null; }
    if (faceMeshRef.current) { faceMeshRef.current.close(); faceMeshRef.current = null; }
    
    setCameraState('OFF');
    setHasCalibrated(false); 
    setIsEngineReady(false);
    
    // [Ref 연동] 스톱 시 Ref 초기화
    setIsFocusing(false);
    isFocusingRef.current = false;

    setServerFeedback("우측 상단의 '🎯 영점 조절' 버튼을 눌러 카메라를 켜주세요."); 
    setServerStatus('--'); 
    setDisplayScore('--');
  };

  const handleStartMeasurement = async () => {
    if (!hasCalibrated) {
      alert("정확한 AI 분석을 위해 먼저 '🎯 영점 조절' 버튼을 눌러 자세 기준점을 설정해 주세요.");
      return;
    }

    try {
      const userInfoStr = localStorage.getItem('user_info');
      if (!userInfoStr) { navigate('/login'); return; }
      const actualUserIdx = JSON.parse(userInfoStr).user_idx;
      
      const result = await immersionApi.start(actualUserIdx);
      if (result && result.success && result.data?.imm_idx) {
        setCurrentImmIdx(result.data.imm_idx); 
        currentImmIdxRef.current = result.data.imm_idx;
        
        // [Ref 연동] State와 Ref 동시 활성화
        setIsFocusing(true); 
        isFocusingRef.current = true;

        setFocusSeconds(0); 
        setHistoryLog([]); 
        setServerFeedback("AI 모니터링이 시작되었습니다. 집중을 유지해 주세요.");
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
        // [Ref 연동] State와 Ref 동시 비활성화
        setIsFocusing(false); 
        isFocusingRef.current = false;
        
        stopCamera(); 
        navigate(`/report/${currentImmIdxRef.current}`); 
      } else {
        alert(result?.message || "리포트 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[STOP MEASUREMENT ERROR]', err.message);
      alert("서버 통신 중 오류가 발생했습니다.");
    }
    finally { setIsAnalyzing(false); }
  };

  const displayStatusLabel = serverStatus === 'WARNING' ? '위험' : serverStatus === 'CAUTION' ? '주의' : serverStatus === 'NORMAL' ? '정상' : '--';

  return (
    <div className="max-w-[1400px] mx-auto min-h-[90vh] p-6 lg:p-10 animate-fade-in font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 relative">
      
      {showOnboarding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-fade-in px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-8 tracking-tighter text-center">정확한 측정을 위해<br/>다음 단계를 따라주세요</h2>
            
            <div className="space-y-6 mb-10">
              <div className="flex items-center gap-5 p-5 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                <div className="w-12 h-12 bg-[#5B44F2] text-white rounded-full flex items-center justify-center font-black text-xl shadow-md shrink-0">1</div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">영점 조절 진행</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold mt-1">우측 상단의 🎯 영점 조절 버튼을 누르면 카메라가 켜집니다. 화면을 보고 3초간 정면을 응시하세요.</p>
                </div>
              </div>
              <div className="flex items-center gap-5 p-5 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                <div className="w-12 h-12 bg-[#5B44F2] text-white rounded-full flex items-center justify-center font-black text-xl shadow-md shrink-0">2</div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">측정 시작</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold mt-1">영점 조절 완료 후 활성화된 ▶ 측정 시작 버튼을 누르면 부드럽게 AI 모니터링이 시작됩니다.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => closeOnboarding(false)} className="flex-1 py-4 bg-[#5B44F2] text-white font-black rounded-xl hover:bg-[#4a36c4] transition-colors shadow-lg active:scale-95">확인했습니다</button>
              <button onClick={() => closeOnboarding(true)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95">다시 보지 않기</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-200/60 dark:border-slate-800/60 transition-colors">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter transition-colors">실시간 집중도 분석</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium transition-colors">AI가 사용자의 집중 상태와 주변 환경을 정밀하게 분석합니다.</p>
        </div>
        <div className="flex gap-4 items-center">
          
          {!isFocusing && !isAnalyzing && (
            <button
              onClick={handleCalibrationRequest}
              disabled={calibrationCountdown !== null || cameraState === 'STARTING'}
              className={`px-6 py-3.5 border rounded-2xl font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${hasCalibrated ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              {cameraState === 'STARTING' ? '카메라 로딩 중...' : hasCalibrated ? '✅ 설정 완료' : calibrationCountdown !== null ? `🎯 설정 중 (${calibrationCountdown})` : '🎯 영점 조절'}
            </button>
          )}
          
          <button
            onClick={isFocusing ? handleStopMeasurement : handleStartMeasurement}
            disabled={isAnalyzing}
            className={`px-10 py-3.5 rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center gap-2 
              ${isAnalyzing ? 'bg-slate-800 text-white shadow-none cursor-wait' : 
                isFocusing ? 'bg-white dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-900/40 shadow-rose-100 dark:shadow-none' : 
                'bg-[#5B44F2] text-white hover:bg-[#4a36c4] shadow-indigo-100 dark:shadow-[0_10px_20px_-10px_rgba(91,68,242,0.5)]'}`}
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
            { label: '진행 시간', value: formatTime(focusSeconds), unit: '', icon: '⏱️', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/30' },
            { label: '집중 에너지', value: displayScore, unit: '%', icon: '⚡', color: 'text-emerald-500 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30' },
            { label: '주변 소음', value: decibel, unit: 'dB', icon: '🎧', color: 'text-slate-500 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-800' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900/50 rounded-3xl p-7 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/20 hover:-translate-y-1 backdrop-blur-sm">
              <div className={`w-16 h-16 rounded-full ${item.bgColor} flex items-center justify-center text-3xl border border-white/50 dark:border-white/5 shadow-inner ${item.color}`}>{item.icon}</div>
              <div>
                <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mb-1.5">{item.label}</p>
                <p className={`text-4xl font-black tracking-tight leading-none ${idx === 0 ? 'font-mono' : ''} text-slate-900 dark:text-white transition-colors`}>{item.value}<span className="text-xl text-slate-400 font-bold ml-1.5">{item.unit}</span></p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col h-full">
            <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex-grow transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/20 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-5 px-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight transition-colors">실시간 AI 비전 분석</h3>
                {isFocusing && isEngineReady && !isAnalyzing && <div className="bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 rounded-full flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold border border-slate-100 dark:border-slate-700 shadow-sm"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>AI 분석 활성화됨</div>}
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

              <div className="w-full aspect-[4/3] bg-slate-950 rounded-2xl relative overflow-hidden shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-800">
                
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-95" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100 z-10" width="640" height="480" />

                {cameraState === 'OFF' && !isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 text-white gap-4 animate-fade-in">
                    <p className="font-bold tracking-wider text-sm text-slate-300">카메라 대기 중... '영점 조절'을 눌러 카메라를 켜주세요.</p>
                  </div>
                )}

                {cameraState === 'STARTING' && !isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 text-white gap-5 animate-fade-in">
                    <div className="w-12 h-12 border-4 border-[#5B44F2] border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-bold text-sm tracking-widest text-slate-200">AI 모델 데이터 및 카메라 로딩 중...</p>
                  </div>
                )}

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
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="p-8 py-10 rounded-[1.75rem] bg-slate-950 dark:bg-slate-900 border border-slate-800/0 dark:border-slate-800 text-white shadow-2xl shadow-slate-300 dark:shadow-none flex flex-col items-center text-center flex-grow relative overflow-hidden transition-all duration-300 hover:shadow-indigo-300/30 dark:hover:border-indigo-900/50">
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

        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mt-2 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/20 backdrop-blur-sm">
          <div className="p-6 px-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/30">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight transition-colors">실시간 데이터 기록</h3>
            <p className="text-slate-400 text-sm font-medium">가장 최근 측정된 5건의 데이터 표기</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs transition-colors">
              <tr>
                <th className="p-5 pl-8">측정 시간</th><th className="p-5">자세 상태</th><th className="p-5">집중도</th><th className="p-5">주변 소음 (dB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {historyLog.length === 0 ? (
                <tr><td colSpan="4" className="p-20 text-center"><div className="text-6xl mb-5 opacity-30">📊</div><p className="text-slate-400 font-bold tracking-widest text-lg opacity-60">측정된 데이터가 없습니다</p></td></tr>
              ) : (
                historyLog.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-5 pl-8 text-slate-600 dark:text-slate-400 font-mono font-bold text-xs">{log.detected_at}</td>
                    <td className="p-5">
                      <span className={`px-3.5 py-1.5 rounded-full text-[12px] font-black tracking-tighter inline-flex items-center gap-1.5 shadow-sm ${log.pose_status === 'WARNING' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50' : log.pose_status === 'CAUTION' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shadow-inner ${log.pose_status === 'WARNING' ? 'bg-rose-500' : log.pose_status === 'CAUTION' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        {log.pose_status === 'WARNING' ? '위험' : log.pose_status === 'CAUTION' ? '주의' : '정상'}
                      </span>
                    </td>
                    <td className="p-5 font-black text-slate-900 dark:text-white text-base">{log.imm_score}</td>
                    <td className="p-5 text-slate-500 dark:text-slate-400 font-bold">{log.decibel}</td>
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