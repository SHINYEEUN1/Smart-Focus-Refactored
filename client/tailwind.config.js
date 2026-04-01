/** @type {import('tailwindcss').Config} */
export default {
  /* FSD 아키텍처로 분리된 모든 계층의 파일들을 테일윈드가 검사하도록 설정합니다. */
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // src 폴더 내의 모든 하위 폴더와 파일을 포함합니다.
  ],
  theme: {
    extend: {
      /* 프로젝트 테마 설정이 필요한 경우 이곳에서 확장합니다. */
    },
  },
  plugins: [],
}