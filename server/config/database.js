// config/database.js
const mysql = require('mysql2/promise'); // promise 버전 사용 (try-catch를 위해)
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    port: process.env.DB_PORT,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    // connectionLimit: 동시에 열어둘 최대 커넥션 수.
    // DB 서버의 max_connections 설정과 서버 인스턴스 수를 감안해 10으로 설정.
    // 요청이 connectionLimit을 초과하면 queueLimit 범위 내에서 대기열에 쌓임.
    connectionLimit: 10,
    // queueLimit: 0은 대기열 무제한을 의미.
    // 트래픽 급증 시 요청이 즉시 거부되지 않고 대기하도록 무제한으로 설정.
    // 단, 서버 메모리 과부하 가능성이 있으므로 모니터링 필요.
    queueLimit: 0,
});

// 서버 시작 시 DB 연결 상태 확인 (개발 환경에서만 출력)
// DB 설정 오류를 조기에 발견하기 위한 헬스 체크용
pool.getConnection()
    .then(conn => {
        if (process.env.NODE_ENV !== 'production') {
            console.log('DB 커넥션 풀 준비 완료');
        }
        conn.release();
    })
    .catch(err => {
        // DB 연결 실패는 서버 전체에 영향을 주므로 환경 무관하게 출력
        console.error('[DB ERROR] 커넥션 풀 생성 실패:', err.message);
    });

module.exports = pool;