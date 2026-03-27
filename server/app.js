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
    const poseBuffer = []; // 1초간 자세를 담을 바구니
    let lastDispatchTime = Date.now();

    socket.emit('engine_ready', { status: 'READY', message: 'AI 분석 엔진 가동 시작' });

    socket.on('stream_data', async (data) => {
        // [변경] 인자 추가: calibration, faceLandmarks 추가 수신
        const { landmarks, noise_db, imm_idx, calibration, faceLandmarks } = data;

        // 1. 사용자 이탈 체크 (기존 로직 유지)
        if (!check_user_presence(landmarks)) {
            return socket.emit('analysis_result', { status: 'USER_NOT_FOUND', message: '사용자를 찾는 중입니다...' });
        }

        // 2. 엔진 분석 수행 (수정된 인자 적용)
        const mode = detect_camera_mode(landmarks);
        const noise_status = analyze_noise_level(noise_db);
        const current_posture = analyze_posture(landmarks, mode, calibration, faceLandmarks);

        // 3. 버퍼링 로직: 현재 프레임의 자세를 바구니에 추가
        poseBuffer.push(current_posture);
        const now = Date.now();

        // 4. 1초(1000ms)가 지나면 최종 결과 도출 및 전송
        if (now - lastDispatchTime >= 1000) {
            const counts = {};
            poseBuffer.forEach(p => counts[p] = (counts[p] || 0) + 1);
            const total = poseBuffer.length;
            
            // 지분율 20% 이상인 자세 중 가장 빈번한 것 선택 (없으면 정자세)
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
            else if (final_posture === 'DROWSY') display_score = 30; // 졸음 점수 추가

            // 6. [기존 유지 로직] 상태 변화시에만 DB 저장
            if (final_posture !== last_saved_status && imm_idx) {
                try {
                    await db.query(
                        "INSERT INTO poses (imm_idx, pose_status, detected_at) VALUES (?, ?, NOW())", 
                        [imm_idx, final_posture]
                    );
                    console.log(`[DB Record] ${last_saved_status} -> ${final_posture}`);
                    last_saved_status = final_posture; 
                } catch (err) {
                    console.error("자세 저장 실패:", err.message);
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