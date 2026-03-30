// 1. 외부 모듈 로드
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./config/database');
require('dotenv').config(); // [중요] .env 파일 로드 추가


// 2. 서버 및 소켓 설정
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        credentials: true
    }
});

// [분석 엔진 로드]
const { 
    detect_camera_mode, 
    analyze_noise_level, 
    check_user_presence, 
    analyze_posture, 
    get_coaching_message 
} = require('./utils/analysis_engine');

// 3. 포트 및 미들웨어 설정
app.set('port', process.env.PORT || 3000);

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. 세션 설정 (환경변수 체크 필수!)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_fallback_secret', // .env 확인
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { 
        maxAge: 1000 * 60 * 60, // 1시간
        secure: false // HTTPS 사용 시 true로 변경
    }
}));

// 5. 정적 파일 접근 (리액트 빌드 폴더)
app.use(express.static(path.join(__dirname, '../client/dist')));


io.on('connection', (socket) => {
    console.log('클라이언트 연결됨:', socket.id);
   

    // 💡 상태 관리를 위한 변수들
    let last_saved_status = null; 
    const poseBuffer = []; 
    let lastDispatchTime = Date.now();
     let last_noise_save_time = 0; 
    const NOISE_SAVE_INTERVAL = 5000;


    socket.emit('engine_ready', { status: 'READY', message: 'AI 분석 엔진 가동 시작' });

    socket.on('stream_data', async (data) => {  
        
        try {
            // 0. 데이터 구조 분해 할당
            const { landmarks, noise_db, imm_idx, calibration, faceLandmarks } = data;
            //console.log("수신 데이터 구조:", data);  
            //console.log("실시간 수신 중인 imm_idx:", imm_idx);
            // 1. 사용자 이탈 체크
            if (!check_user_presence(landmarks)) {
                return socket.emit('analysis_result', { status: 'USER_NOT_FOUND', message: '사용자를 찾는 중입니다...' });
            }

            // 2. 엔진 분석 수행
            const mode = detect_camera_mode(landmarks);
            const noise_status = analyze_noise_level(noise_db);
            const current_posture = analyze_posture(landmarks, mode, calibration, faceLandmarks);

            // 3. 버퍼링 로직
            poseBuffer.push(current_posture);
            const now = Date.now();

            // 4. 1초(1000ms)가 지나면 최종 결과 도출 및 전송
            if (now - lastDispatchTime >= 1000) {
                const counts = {};
                poseBuffer.forEach(p => counts[p] = (counts[p] || 0) + 1);
                const total = poseBuffer.length || 1;
                
                const final_posture = Object.entries(counts).find(([, c]) => c / total >= 0.2)?.[0] || 'GOOD_POSTURE';

                // 버퍼 및 타이머 리셋
                poseBuffer.length = 0;
                lastDispatchTime = now;

                // 5. 점수 계산 및 메시지 생성
                const coaching_msg = get_coaching_message(final_posture, noise_status);
                let display_score = 100;
                if (final_posture === 'TURTLE_NECK') display_score = 80;
                else if (final_posture === 'SLUMPED') display_score = 40;
                else if (final_posture === 'LEANING_ON_HAND') display_score = 60;
                else if (final_posture === 'DROWSY') display_score = 30;

                // 6. 상태 변화시에만 DB 저장
                if (final_posture !== last_saved_status && imm_idx) { 
                    try {
                        const p_type = (final_posture === 'GOOD_POSTURE' || final_posture === 'NORMAL') ? 'GOOD' : 'BAD';
                        await db.query(
                            "INSERT INTO poses (imm_idx, pose_type, pose_status, count, detected_at) VALUES (?, ?, ?, 1, NOW())", 
                            [imm_idx, p_type, final_posture]
                            );
                        console.log(`[DB 저장 성공] 세션 ${imm_idx}: ${final_posture}`);
                        last_saved_status = final_posture; 
                    } catch (dbErr) {
                        console.error("자세 저장 실패:", dbErr.message);
                    }
                }
                if (imm_idx && noise_db !== undefined && (now - last_noise_save_time >= NOISE_SAVE_INTERVAL)) {
                    try {
                        await db.query(
                        "INSERT INTO noises (imm_idx, decibel, obj_name, reliability, is_summary, detected_at) VALUES (?, ?, ?, ?, 0, NOW())",
                         [imm_idx, noise_db, 'ambient', 1]
                        );
                        console.log(`[소음 저장 성공] ${noise_db}dB`);
                        last_noise_save_time = now; 
                        } catch (noiseErr) {
                        console.error("소음 저장 실패:", noiseErr.message);
                        }
                }

                // 7. 클라이언트에 결과 전송
                socket.emit('analysis_result', {
                    status: 'SUCCESS',
                    camera_mode: mode,
                    noise_status,
                    posture_status: final_posture,
                    current_score: display_score,
                    message: coaching_msg,
                    timestamp: new Date()
                });
            }
        } catch (err) {
            // 전체 로직에 대한 에러 핸들링 (닫는 괄호 추가됨)
            console.error("스트림 데이터 처리 중 치명적 에러:", err);
        }
    }); 
});

// 6. 라우터 연결
const mainRouter = require('./routes/main');
const userRouter = require('./routes/user');
const immersionRouter = require('./routes/immersion');
const mypageRouter = require('./routes/mypage');

app.use('/', mainRouter);
app.use('/user', userRouter);
app.use('/api/immersion', immersionRouter);
app.use('/api/mypage', mypageRouter);

// 7. 에러 처리 미들웨어 (404 & 500)
app.use((req, res) => {
    res.status(404).json({ success: false, message: "존재하지 않는 경로입니다." });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: "서버 내부 오류 발생" });
});

// 8. 서버 실행
server.listen(app.get('port'), () => {
    console.log(`${app.get('port')}번 포트에서 서버/소켓 가동 중...`);
});