const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcrypt');

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

module.exports = router;