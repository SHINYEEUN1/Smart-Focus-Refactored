/** @type {import('tailwindcss').Config} */
export default {
  /* 수동 다크모드 제어를 위해 class 전략 활성화 (html 태그의 dark 클래스 감지) */
  darkMode: 'class',
  
  /* FSD 아키텍처로 분리된 모든 계층의 파일들을 테일윈드가 검사하도록 설정 */
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* 프로젝트 테마 커스텀 확장 영역 */
    },
  },
  plugins: [],
}