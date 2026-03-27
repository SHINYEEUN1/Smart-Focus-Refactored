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

// [POST] /join - 회원가입
router.post('/join', async (req, res, next) => {
    const { email, pwd, nick } = req.body;

    try {
        // 1. 중복 체크
        const [existingUser] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: "이미 사용 중인 이메일입니다.",
                code: "DUPLICATE_EMAIL"
            });
        }

        // 2. 암호화
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(pwd, saltRounds);

        // 3. DB 저장 (created_at은 DB 설정에 따라 생략 가능하지만 명시해두면 안전합니다)
        const sql = "INSERT INTO users (email, pwd, nick, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)";
        await pool.query(sql, [email, hashedPassword, nick]);

        res.status(201).json({ success: true, message: "회원가입 완료!" });

    } catch (err) {
        // DB 제약조건 위반 에러 처리 (Email Unique 등)
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "이미 존재하는 정보입니다." });
        }
        next(err);
    }
});

// [POST] /login - 로그인
router.post('/login', async (req, res, next) => {
    const { email, pwd } = req.body;

    try {
        const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        
        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                message: "이메일 또는 비밀번호가 일치하지 않습니다.",
                code: "LOGIN_FAILED"
            });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(pwd, user.pwd);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "이메일 또는 비밀번호를 확인해주세요.",
                code: "LOGIN_FAILED"
            });
        }

        // 비밀번호 제외하고 세션 저장
        const { pwd: _, ...user_info } = user;
        req.session.user = user_info;

        res.json({
            success: true,
            message: `${user_info.nick}님 환영합니다!`,
            user_info: req.session.user 
        });

    } catch (err) {
        next(err);
    }
});

// [POST] /user/logout - 로그아웃 (새로 추가할 부분!)
router.post('/logout',isAuthenticated, (req, res) => {
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