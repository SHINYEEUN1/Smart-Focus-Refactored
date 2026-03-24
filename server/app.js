// 1. 외부 모듈 로드
const express = require('express');
const path = require('path');
const cors = require('cors');

// 2. 서버 객체 만들기
const app = express();

// 3. 포트 번호 지정
app.set('port', process.env.PORT||3000);

// pool 설정
const pool = require('./config/database');

// 8. cors 설정
app.use(cors());

// 9. post 방식의 데이터 주고 받을 때 인코딩 처리
//    json형식으로 오는 데이터를 js객체로 처리를 할 수 있게 변경 (8,9 미들웨어 설정)
app.use(express.json());
app.use(express.urlencoded({extended:true}));

//dist폴더 접근 (정적 파일)
app.use(express.static(path.join(__dirname, '../client/dist')));

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


// 4. 서버 실행
app.listen(app.get('port'), ()=>{console.log(`${app.get('port')}번 포트에서 대기중...`);});

// 7. 노드 서버 실행
// > nodemon app.js

// 8. 브라우저 창에서 'localhost:3000/' 실행