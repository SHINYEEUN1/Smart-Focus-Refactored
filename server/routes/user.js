const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;


// --- [추가] Passport 유저 직렬화 (세션에 저장하는 규칙) ---
passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) => {
    done(null, user);
});

// --- [추가] 구글 로그인 전략 설정 ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_ID,      // .env에 저장할 클라이언트 ID
    clientSecret: process.env.GOOGLE_SECRET,  // .env에 저장할 시크릿 키
    callbackURL: "/auth/google/callback" // 백엔드 콜백 주소
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const snsId = profile.id;
        const nick = profile.displayName;

        // 1. DB에 해당 소셜 유저가 있는지 확인
        const [users] = await pool.query("SELECT * FROM users WHERE email = ? AND provider = 'google'", [email]);

        if (users.length > 0) {
            // 이미 가입된 유저라면 그대로 로그인
            return done(null, users[0]);
        } else {
            // 신규 유저라면 DB에 저장 (비밀번호는 NULL)
            const sql = "INSERT INTO users (email, nick, provider, sns_id) VALUES (?, ?, 'google', ?)";
            const [result] = await pool.query(sql, [email, nick, snsId]);
            
            const newUser = { id: result.insertId, email, nick, provider: 'google' };
            return done(null, newUser);
        }
    } catch (err) {
        return done(err);
    }
  }
));


// 1. [추가] 인증번호 임시 저장소 (메모리)
// 서버가 꺼지면 초기화됩니다. 실제 서비스에선 Redis 등을 쓰지만 팀 프로젝트에선 이 방식이 가장 빠릅니다.
const tempAuthCodes = {};

// 2. [추가] 메일 발송 설정 (Nodemailer)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER, // .env 파일의 ID
        pass: process.env.MAIL_PASS  // .env 파일의 앱 비밀번호
    }
});



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

// [POST] /send-email - 인증번호 발송
router.post('/send-email', async (req, res) => {
    const { email } = req.body;
    
    // 6자리 랜덤 숫자 생성
    const authCode = Math.floor(100000 + Math.random() * 900000);

    try {
        await transporter.sendMail({
            from: `"smart-focus" <${process.env.MAIL_USER}>`,
            to: email,
            subject: "[smart-focus] 회원가입 인증번호입니다.",
            text: `인증번호는 [${authCode}] 입니다. 3분 이내에 입력해주세요.`
        });

        // 메모리에 저장 (3분 후 만료)
        tempAuthCodes[email] = {
            code: authCode,
            isVerified: false,
            expiry: Date.now() + 3 * 60 * 1000 
        };

        res.json({ success: true, message: "인증번호가 발송되었습니다." });
    } catch (err) {
        console.error("메일 발송 에러:", err);
        res.status(500).json({ success: false, message: "메일 발송에 실패했습니다." });
    }
});

// --- [신규 추가] 이메일 인증 관련 라우터 시작 ---
// [POST] /user/verify-code - 인증번호 확인
router.post('/verify-code', (req, res) => {
    const { email, code } = req.body;
    const authInfo = tempAuthCodes[email];

    if (authInfo && authInfo.code == code && authInfo.expiry > Date.now()) {
        authInfo.isVerified = true; // ✅ 인증 성공 상태로 변경
        res.json({ success: true, message: "이메일 인증이 완료되었습니다." });
    } else {
        res.status(400).json({ success: false, message: "번호가 틀렸거나 만료되었습니다." });
    }
});

// [POST] /join - 회원가입
router.post('/join', async (req, res, next) => {
    const { email, pwd, nick } = req.body;

    // 💡 [수정] 이메일 인증 여부 확인 검문소
    const authInfo = tempAuthCodes[email];
    if (!authInfo || !authInfo.isVerified) {
        return res.status(400).json({ 
            success: false, 
            message: "이메일 인증을 먼저 완료해주세요." 
        });
    }

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

        delete tempAuthCodes[email];

        res.status(201).json({ success: true, message: "회원가입 완료!" });

    } catch (err) {
        // DB 제약조건 위반 에러 처리 (Email Unique 등)
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "이미 존재하는 정보입니다." });
        }
        next(err);
    }
});

//[추가] 닉네임 중복 체크 (프론트 요청사항)
// 사용자가 닉네임을 입력하고 '중복 확인' 버튼을 누를 때 호출됩니다.
router.post('/check-nick', async (req, res) => {
    const { nick } = req.body;

    if (!nick || nick.trim() === "") {
        return res.status(400).json({ success: false, message: "닉네임을 입력해주세요." });
    }

    try {
        const [rows] = await pool.query("SELECT * FROM users WHERE nick = ?", [nick]);
        
        if (rows.length > 0) {
            // 중복된 닉네임이 있는 경우
            return res.json({ 
                success: false, 
                message: "이미 사용 중인 닉네임입니다.",
                code: "DUPLICATE_NICK" 
            });
        }

        // 중복이 없는 경우
        res.json({ 
            success: true, 
            message: "사용 가능한 닉네임입니다." 
        });
    } catch (err) {
        console.error("닉네임 체크 에러:", err);
        res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
    }
});

// --- [추가] 1. 구글 로그인 시작 라우터 ---
// 프론트엔드에서 http://localhost:3000/auth/google 로 접속하면 여기가 실행됩니다.
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// --- [신규 추가] 소셜 로그인 실행 라우터 ---
// 1. 프론트엔드에서 구글 로그인 버튼을 눌렀을 때 가는 곳
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }), 
  (req, res) => {
    // 1. 유저 정보를 세션에 확실히 담기
    req.session.user = req.user; 
    
    // 2. [매우 중요] 세션을 DB/메모리에 물리적으로 저장한 후 리다이렉트
    // 이 콜백 함수가 실행된 시점은 세션 저장이 100% 끝난 시점입니다.
    req.session.save((err) => {
      if (err) {
        console.error("세션 저장 중 에러:", err);
        return res.redirect('http://localhost:5173/login');
      }
      
      // 이제 리액트 대시보드로 이동하면 세션 쿠키가 유효합니다.
      res.redirect('http://localhost:5173/dashboard');
    });
  }
);



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