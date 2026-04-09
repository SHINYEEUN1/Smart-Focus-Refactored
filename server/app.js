// 서버 실행에 필요한 핵심 모듈들과 설정 파일들을 불러오는 구간

const express = require('express'); // express: 서버 프레임워크
const path = require('path');
const cors = require('cors'); // cors: 프론트와의 교차 출처 요청 허용
const session = require('express-session'); // session: 로그인 상태 유지
const http = require('http');
const { Server } = require('socket.io'); // http + socket.io: 실시간 소켓 통신 처리
const passport = require('passport'); // passport: 인증/세션 사용자 관리
require('dotenv').config(); // dotenv: .env 환경변수 로드

// 프로젝트 내부 설정/기능 파일 불러오기

const configurePassport = require('./config/passport'); // configurePassport: passport 전략 및 serialize/deserialize 설정
const registerAnalysisSocket = require('./sockets/analysis.socket'); // registerAnalysisSocket: 실시간 자세/소음 분석용 소켓 이벤트 등록

// 각 router: 기능별 API 라우트 연결

const mainRouter = require('./routes/main');
const userRouter = require('./routes/user');
const immersionRouter = require('./routes/immersion');
const mypageRouter = require('./routes/mypage');

// express 앱 생성 후, socket.io 연결을 위해 http 서버 객체를 따로 생성

const app = express(); // app은 일반 API 요청 처리
const server = http.createServer(app); // server는 API + socket 통신을 함께 처리

// 프론트 주소와 서버 포트를 환경변수에서 읽어옴
// 환경변수가 없을 경우 로컬 개발용 기본값 사용

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 3000;

app.set('port', PORT);

// 프론트엔드에서 서버로 요청할 수 있도록 CORS 허용
// credentials: true 설정으로 세션 쿠키를 포함한 요청 허용

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

// 클라이언트가 보낸 JSON / form-urlencoded 데이터를 req.body로 읽기 위한 설정

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 로그인 상태 유지를 위한 세션 설정
// rolling: true → 요청이 올 때마다 세션 만료 시간을 갱신한다.
// 이유: 사용자가 활동 중인 동안은 로그아웃되지 않아야 하며,
//       일정 시간 동안 아무 요청도 없을 때만 세션이 만료되도록 하기 위함.
// secure: production에서만 HTTPS 쿠키 전송 → 개발 환경에서는 HTTP로도 동작 가능하게 함.
// httpOnly: 자바스크립트에서 쿠키 접근 차단 → XSS 공격으로 세션 탈취 방지.
// sameSite: lax → CSRF 완화 및 기본적인 크로스 사이트 정책 설정.

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 1000 * 60 * 60, // maxAge: 세션 유지 시간(현재 1시간)
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}));

// passport 인증 기능 활성화
// initialize(): passport 기능 시작
// session(): 세션에 저장된 user_idx로 DB를 조회해 req.user를 복원

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// 프론트엔드 빌드 결과물(dist)을 정적 파일로 제공
// 배포 시 서버에서 프론트 결과물도 함께 서비스할 수 있게 함

app.use(express.static(path.join(__dirname, '../client/dist')));

// 기능별 라우터 연결
// /auth: 회원가입, 로그인, 소셜 로그인 등 사용자 인증 관련
// /api/immersion: 집중 세션 시작/종료/리포트 API
// /api/mypage: 마이페이지/통계 관련 API

app.use('/', mainRouter);
// /auth와 /user 두 경로에 동일한 라우터를 마운트한다.
// 이유: 클라이언트 API가 기능에 따라 두 경로를 혼용하고 있다.
// - /auth/*: 소셜 로그인(Google/Kakao/Naver), 세션 확인, 이메일 인증
// - /user/*: 일반 로그인, 로그아웃, 회원가입
// 두 경로를 분리하려면 클라이언트 API 파일도 함께 변경해야 하므로 현재는 유지한다.
app.use('/auth', userRouter);
app.use('/user', userRouter);
app.use('/api/immersion', immersionRouter);
app.use('/api/mypage', mypageRouter);

// socket.io 서버 생성
// 프론트와 실시간 데이터 통신(자세 분석, 점수 변화 등)을 처리
// socket.io는 자체적으로 CORS를 독립적으로 관리하므로, express cors 설정과 별도로 지정해야 한다.
// credentials: true를 함께 설정해야 소켓 연결 시 세션 쿠키가 포함된다.

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
});

// 실시간 분석 관련 소켓 이벤트를 등록
// 클라이언트 연결, 스트림 데이터 수신, 분석 결과 emit 등을 담당

registerAnalysisSocket(io);

// 위에서 연결되지 않은 모든 요청은 404 응답 처리

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '존재하지 않는 경로입니다.',
  });
});

// 서버 내부에서 발생한 예외를 공통 처리하는 에러 핸들러
// 에러 내용을 콘솔에 출력하고 클라이언트에는 500 응답 반환

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    message: '서버 내부 오류 발생',
  });
});

// 설정된 포트에서 HTTP 서버와 socket 서버를 함께 실행

server.listen(app.get('port'), () => {
  console.log(`${app.get('port')}번 포트에서 서버/소켓 가동 중...`);
});
