const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const passport = require('passport');
require('dotenv').config();

const configurePassport = require('./config/passport');
const registerAnalysisSocket = require('./sockets/analysis.socket');

const mainRouter = require('./routes/main');
const userRouter = require('./routes/user');
const immersionRouter = require('./routes/immersion');
const mypageRouter = require('./routes/mypage');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 3000;

app.set('port', PORT);

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 1000 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}));

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, '../client/dist')));

app.use('/', mainRouter);
app.use('/auth', userRouter);
app.use('/user', userRouter);
app.use('/api/immersion', immersionRouter);
app.use('/api/mypage', mypageRouter);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
});

registerAnalysisSocket(io);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '존재하지 않는 경로입니다.',
  });
});

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    message: '서버 내부 오류 발생',
  });
});

server.listen(app.get('port'), () => {
  console.log(`${app.get('port')}번 포트에서 서버/소켓 가동 중...`);
});