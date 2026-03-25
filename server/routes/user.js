const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcrypt');

// [검문소] 로그인 여부를 체크하는 미들웨어 (여기에 추가!)
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next(); // 세션이 있으면 통과!
    } else {
        res.status(401).json({
            success: false,
            message: "세션이 만료되었습니다. 다시 로그인해주세요.",
            code: "SESSION_EXPIRED"
        });
    }
};

// [POST] /user/join - 회원가입
router.post('/join', async (req, res, next) => {
    const { email, pwd, nick } = req.body;

    try {
        // 1. 중복 이메일 체크
        const [existingUser] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        
        if (existingUser.length > 0) {
            // 중복된 이메일이 있으면 친절하게 에러 메시지 전달
            return res.status(400).json({
                success: false,
                message: "이미 사용 중인 이메일입니다.",
                code: "DUPLICATE_EMAIL"
            });
        }

        // 2. 비밀번호 암호화 (해싱)
        // 숫자가 높을수록 보안은 강해지지만 속도는 느려집니다. 보통 10을 씁니다.
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(pwd, saltRounds);

        // 3. DB에 저장
        const sql = "INSERT INTO users (email, pwd, nick) VALUES (?, ?, ?)";
        await pool.query(sql, [email, hashedPassword, nick]);

        res.status(201).json({
            success: true,
            message: "회원가입이 완료되었습니다! 환영합니다."
        });

    } catch (err) {
        // 예상치 못한 에러는 공통 에러 핸들러로!
        next(err);
    }
});

// [POST] /user/login - 로그인
router.post('/login', async (req, res, next) => {
    const { email, pwd } = req.body;

    try {
        // 1. 해당 이메일 유저가 있는지 확인
        const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        
        // [보안 규격] 유저가 없어도 '비밀번호가 틀린 것'과 동일한 메시지를 보냅니다.
        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                message: "이메일 또는 비밀번호가 일치하지 않습니다.",
                code: "LOGIN_FAILED"
            });
        }

        const user = users[0]; // DB에서 가져온 로우 데이터

        // 2. 비밀번호 비교
        const isMatch = await bcrypt.compare(pwd, user.pwd);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "이메일 또는 비밀번호를 확인해주세요.",
                code: "LOGIN_FAILED"
            });
        }

        // 🔥 [수정 포인트] 보안을 위해 pwd만 쏙 빼고 나머지를 user_info에 담기
        // user 객체에서 pwd라는 키를 찾아 제외하고, 나머지를 user_info라는 새 객체에 모읍니다.
        const { pwd: _, ...user_info } = user;

        // 3. 세션에 사용자 정보 기록
        // 이제 서버 세션과 응답 데이터에 비밀번호가 포함되지 않습니다.
        req.session.user = user_info;

        console.log("===== 세션 저장 완료 =====");
        console.log(req.session.user); // 여기에 유저 정보가 출력되어야 함
        console.log("세션 ID:", req.sessionID); 
        console.log("========================");
        // 4. 로그인 성공 응답
        res.json({
            success: true,
            message: `${user_info.nick}님, 환영합니다!`,
            user_info: req.session.user // 리액트 팀원과 약속한 'user_info' 키값 사용
        });

    } catch (err) {
        next(err);
    }
});

// [POST] /user/logout - 로그아웃 (새로 추가할 부분!)
router.post('/logout', (req, res) => {
    // 1. 서버 메모리에 있는 세션 보따리 파괴
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "로그아웃 중 에러 발생" });
        }
        
        // 2. 브라우저에 남은 쿠키(입장권 번호표)도 삭제
        // express-session의 기본 쿠키 이름은 'connect.sid'입니다.
        res.clearCookie('connect.sid'); 
        
        res.json({ success: true, message: "로그아웃 되었습니다." });
    });
});

router.get('/check', (req, res) => {
    // 세션에 저장된 유저 데이터가 있는지 확인
    if (req.session.user) {
        // DB 컬럼명(ex: user_id, user_nick)이 포함된 객체를 그대로 응답
        res.json({
            success: true,
            user_info: req.session.user // 세션에 담긴 DB 로우(row) 데이터를 그대로 보냄
        });
    } else {
        res.json({
            success: false,
            message: "비회원 상태입니다."
        });
    }
});

module.exports = router;