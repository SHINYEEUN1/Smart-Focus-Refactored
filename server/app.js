// 1. 외부 모듈 로드
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const http = require('http'); // [추가] http 모듈 로드
const { Server } = require('socket.io'); // [추가] socket.io 로드

// 2. 서버 객체 만들기
const app = express();
const server = http.createServer(app); // [추가] http 서버 생성
const io = new Server(server, {        // [추가] 소켓 서버 연결 및 CORS 설정
    cors: {
        origin: "http://localhost:5173",
        credentials: true
    }
});

// [추가] 분석 엔진 가져오기 (파일이 utils 폴더에 있어야 함)
const { 
    detect_camera_mode, 
    analyze_noise_level, 
    check_user_presence, 
    analyze_posture, 
    get_coaching_message 
} = require('./utils/analysis_engine');

// 3. 포트 번호 지정
app.set('port', process.env.PORT||3000);

// pool 설정
const pool = require('./config/database');

// 8. cors 설정
app.use(cors({origin: "http://localhost:5173",
    credentials: true
}));

// 9. post 방식의 데이터 주고 받을 때 인코딩 처리
//    json형식으로 오는 데이터를 js객체로 처리를 할 수 있게 변경 (8,9 미들웨어 설정)
app.use(express.json());
app.use(express.urlencoded({extended:true}));

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET, // .env에 저장한 키
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { 
        maxAge: 1000 * 60 * 60, // 1시간 유지
        secure: false 
    }
}));

//dist폴더 접근 (정적 파일)
app.use(express.static(path.join(__dirname, '../client/dist')));

// ---------------------------------------------------------
// [추가] 5단계: 실시간 분석 소켓 로직 (라우터 설정 근처가 좋습니다)
// ---------------------------------------------------------
// ---------------------------------------------------------
// [최종] 6단계: 실시간 분석 소켓 로직 (snake_case 적용)
// ---------------------------------------------------------
io.on('connection', (socket) => {
    console.log('클라이언트와 소켓 연결됨! ID:', socket.id);

    // 엔진 준비 완료 신호 전송
    socket.emit('engine_ready', { 
        status: 'READY',
        message: '실시간 AI 분석 엔진이 가동되었습니다.' 
    });

    socket.on('stream_data', (data) => {
        // 리액트 팀원에게 data도 { landmarks, noise_db }로 보내달라고 요청하세요!
        const { landmarks, noise_db } = data; 

        // 1. 사용자 이탈 예외 처리
        if (!check_user_presence(landmarks)) {
            return socket.emit('analysis_result', {
                status: 'USER_NOT_FOUND',
                message: '사용자를 찾는 중입니다...' 
            });
        }

        // 2. 통합 분석 실행
        const camera_mode = detect_camera_mode(landmarks);
        const noise_status = analyze_noise_level(noise_db);
        const posture_status = analyze_posture(landmarks);
        
        // 3. 코칭 메시지 생성
        const coaching_msg = get_coaching_message(posture_status, noise_status);

        // 4. 결과 전송 (모든 결과값도 snake_case로 통일)
        socket.emit('analysis_result', {
            status: 'SUCCESS',
            camera_mode,     
            noise_status,    
            posture_status,  
            message: coaching_msg,
            timestamp: new Date()
        });
    });

    socket.on('disconnect', () => {
        console.log('클라이언트 접속 종료');
    });
});

// 5. 만들어둔 라우터 설계도(index.js) 가져오기
const mainRouter = require('./routes/main');
const userRouter = require('./routes/user');

// 6. '/'로 들어오면 indexRouter로 보내야해요.
app.use('/', mainRouter);
app.use('/user', userRouter);

// 7. dist폴더안에 접근하는 코드
//app.use(express.static(path.join(__dirname, '../client/dist')));

// 1. 404 에러 처리 (위의 라우터들에 해당 주소가 없을 때 실행됨)
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: "존재하지 않는 경로입니다.",
        code: "NOT_FOUND"
    });
});

// 2. 500 서버 에러 처리 (코드 실행 중 try-catch에서 throw된 에러를 여기서 잡음)
app.use((err, req, res, next) => {
    console.error(`[서버 에러] ${new Date().toLocaleString()}`);
    console.error(err.stack); // 터미널에 상세 에러 출력

    res.status(500).json({
        success: false,
        message: "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        code: "INTERNAL_SERVER_ERROR"
    });
});


// 4. 서버 실행 [변경] app.listen 대신 server.listen을 사용해야 소켓이 작동함!
server.listen(app.get('port'), () => {
    console.log(`${app.get('port')}번 포트에서 서버와 소켓 대기중...`);
});

// 7. 노드 서버 실행
// > nodemon app.js

// 8. 브라우저 창에서 'localhost:3000/' 실행