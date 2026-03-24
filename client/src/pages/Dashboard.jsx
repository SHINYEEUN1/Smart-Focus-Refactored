import React, { useEffect, useRef, useState } from 'react';
import Card from '../components/Card';
import { evaluateSmartFocus, resetStaticTracking } from '../SFEngine';

export default function Dashboard() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const audioContextRef = useRef(null);
  const poseRef = useRef(null);
  const faceMeshRef = useRef(null);

  const faceLandmarksRef = useRef(null); 
  const decibelRef = useRef(0); 
  const calibrationRef = useRef(null); 
  const needsCalibrationRef = useRef(false);
  const lastSentTimeRef = useRef(0); 

  const [decibel, setDecibel] = useState(0);
  const [isFocusing, setIsFocusing] = useState(false);
  const [engineResult, setEngineResult] = useState(null); 
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [historyLog, setHistoryLog] = useState([]);

  const sendFocusDataToServer = async (analysisData, currentDb) => {
    const payload = {
      detected_at: new Date().toISOString(), 
      pose_status: analysisData?.pose?.status || 'NORMAL', 
      decibel: currentDb, 
    };
    console.log("🚀 [대기중] 실시간 데이터 측정됨:", payload);
  };

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

  const getAIFeedback = (pose, db) => {
    if (!isFocusing) return "측정을 시작하려면 상단의 '▶ 측정 시작' 버튼을 눌러주세요.";
    if (!pose) return "AI 모델을 로딩 중입니다. 잠시만 대기해주세요...";
    let fb = "";
    if (pose.status === 'WARNING') fb = `[경고] 자세가 심하게 흐트러졌습니다! 즉시 허리를 펴고 30초간 목 스트레칭을 권장합니다. `;
    else if (pose.status === 'CAUTION') fb = `[주의] 자세가 조금 틀어졌습니다. 화면과 적정 거리를 유지하세요. `;
    else fb = "매우 훌륭합니다! 바른 자세로 최고의 몰입도를 보여주고 있습니다. ";
    fb += (db > 65) ? `현재 소음(${db}dB)이 높아 집중력이 깨질 수 있습니다.` : `주변 환경도 지극히 안정적입니다.`;
    return fb;
  };

  const startCamera = async () => {
    const loadScript = (src) => new Promise((res) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; document.body.appendChild(s);
    });
    if (!window.Pose) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
    if (!window.FaceMesh) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
    if (!window.Camera) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext(); audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser(); const source = audioCtx.createMediaStreamSource(stream); source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateDecibel = () => {
        if (!audioContextRef.current) return; analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const currentDb = Math.round(avg * 1.5); decibelRef.current = currentDb; setDecibel(currentDb); requestAnimationFrame(updateDecibel); 
      };
      updateDecibel();
    } catch(err) { console.error("마이크 오류", err); }

    const SafePose = window.Pose; const SafeCamera = window.Camera; const SafeFaceMesh = window.FaceMesh; 
    const faceMesh = new SafeFaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    const pose = new SafePose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    faceMeshRef.current = faceMesh; poseRef.current = pose;

    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });

    faceMesh.onResults((res) => { faceLandmarksRef.current = res.multiFaceLandmarks?.[0] || null; });
    pose.onResults((res) => {
      if (!canvasRef.current || !res.poseLandmarks) return;
      const ctx = canvasRef.current.getContext('2d'); ctx.save(); ctx.clearRect(0, 0, 640, 480);
      ctx.strokeStyle = "rgba(234, 255, 113, 0.8)"; ctx.lineWidth = 2;
      res.poseLandmarks.forEach(p => { ctx.beginPath(); ctx.arc(p.x * 640, p.y * 480, 3, 0, 2 * Math.PI); ctx.fillStyle = "#D9F99D"; ctx.fill(); ctx.stroke(); }); ctx.restore();

      if (needsCalibrationRef.current) { calibrationRef.current = { distY: Math.abs(res.poseLandmarks[7].y - res.poseLandmarks[11].y) }; needsCalibrationRef.current = false; }
      
      const analysis = evaluateSmartFocus({ landmarks: res.poseLandmarks, faceLandmarks: faceLandmarksRef.current, db: decibelRef.current }, calibrationRef.current);
      setEngineResult(analysis);

      const now = Date.now();
      if (now - lastSentTimeRef.current >= 1000) { 
        lastSentTimeRef.current = now; 
        sendFocusDataToServer(analysis, decibelRef.current);
        const dynamicScore = analysis?.pose?.status === 'NORMAL' ? '96%' : analysis?.pose?.status === 'CAUTION' ? '72%' : '45%'; 
        const time = new Date().toLocaleTimeString('ko-KR'); 
        
        setHistoryLog(prev => [{ detected_at: time, pose_status: analysis?.pose?.status || 'NORMAL', imm_score: dynamicScore, decibel: `${decibelRef.current} dB` }, ...prev].slice(0, 5));
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

  const stopCamera = () => {
    if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
    if (videoRef.current?.srcObject) { videoRef.current.srcObject.getTracks().forEach(t => t.stop()); videoRef.current.srcObject = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (poseRef.current) { poseRef.current.close(); poseRef.current = null; }
    if (faceMeshRef.current) { faceMeshRef.current.close(); faceMeshRef.current = null; }
    setEngineResult(null);
  };

  return (
    <div className="w-full bg-[#Eef2f6] min-h-[90vh] p-6 lg:p-10 animate-fade-in font-sans">
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
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="flex flex-col gap-10 h-full justify-center p-8 py-12">
            <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100 pb-3">Session Metrics</h3>
            <div className="flex items-center gap-3 xl:gap-5">
              <div className="w-12 h-12 xl:w-14 xl:h-14 shrink-0 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner"><svg className="w-6 h-6 xl:w-7 xl:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
              <div className="min-w-0"><p className="text-xs font-bold text-slate-400 mb-1 truncate">진행 시간</p><p className="text-2xl sm:text-3xl xl:text-4xl font-black font-mono text-slate-900 leading-none tracking-tighter truncate">{formatTime(focusSeconds)}</p></div>
            </div>
            <div className="flex items-center gap-3 xl:gap-5">
              <div className="w-12 h-12 xl:w-14 xl:h-14 shrink-0 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner"><svg className="w-6 h-6 xl:w-7 xl:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.334.334a1 1 0 01-.707.293H9.414a1 1 0 01-.707-.293l-.334-.334z"></path></svg></div>
              <div className="min-w-0"><p className="text-xs font-bold text-slate-400 mb-1 truncate">몰입 에너지</p><p className="text-2xl sm:text-3xl xl:text-4xl font-black text-slate-900 leading-none truncate">{isFocusing ? (engineResult?.pose?.status === 'NORMAL' ? '96' : engineResult?.pose?.status === 'CAUTION' ? '72' : '45') : '--'}<span className="text-sm xl:text-lg opacity-40 ml-1">%</span></p></div>
            </div>
            <div className="flex items-center gap-3 xl:gap-5">
              <div className="w-12 h-12 xl:w-14 xl:h-14 shrink-0 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner"><svg className="w-6 h-6 xl:w-7 xl:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg></div>
              <div className="min-w-0"><p className="text-xs font-bold text-slate-400 mb-1 truncate">환경 소음</p><p className="text-2xl sm:text-3xl xl:text-4xl font-black text-slate-900 leading-none truncate">{decibel}<span className="text-sm xl:text-lg opacity-40 ml-1">dB</span></p></div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-6 flex flex-col">
          <Card className="flex-grow p-4 bg-white relative overflow-hidden flex flex-col shadow-inner border-slate-200">
            <h3 className="font-bold text-slate-800 text-lg mb-4 px-2 tracking-tight">Live Analysis Video</h3>
            <div className="w-full flex-grow bg-slate-900 rounded-2xl relative overflow-hidden shadow-2xl">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-90" />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100 z-10" width="640" height="480" />
              {!isFocusing && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20 text-white font-bold tracking-widest text-sm">카메라 대기 중</div>}
              {isFocusing && !engineResult && <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-20 text-white"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div><p className="font-bold text-sm tracking-widest">AI MODEL LOADING...</p></div>}
              {isFocusing && engineResult && <div className="absolute top-4 right-4 bg-black/50 px-3 py-1.5 rounded-md flex items-center gap-2 z-20 text-white text-xs font-bold"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>REC</div>}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-6">
          <Card className="flex-1 flex flex-col items-center justify-center p-10 bg-slate-900 border-none text-white shadow-2xl">
             <h3 className="font-bold text-indigo-400 text-xs uppercase tracking-widest mb-10 border-b border-indigo-900/50 w-full text-center pb-4">Status & Insights</h3>
             <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-8 border-4 transition-all duration-500 ${engineResult?.pose?.status === 'WARNING' ? 'border-rose-500 text-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]' : 'border-emerald-500 text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]'}`}>
                <span className="font-black text-2xl tracking-tighter">{isFocusing ? (engineResult?.pose?.status || 'NORMAL') : '--'}</span>
             </div>
             <p className="text-center font-bold text-slate-300 mb-10 break-keep text-sm leading-relaxed">{getAIFeedback(engineResult?.pose, decibel)}</p>
             <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div style={{width: `${decibel}%`}} className={`h-full transition-all duration-300 ${decibel > 65 ? 'bg-rose-500' : 'bg-[#5B44F2]'}`}></div>
             </div>
          </Card>
        </div>
      </div>

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