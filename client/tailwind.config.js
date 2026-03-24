/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind가 어떤 파일들을 검사해서 CSS를 생성할지 경로를 지정합니다.
  // 여기에 등록된 파일 안에서 사용된 클래스(예: text-blue-500)만 골라서 빌드하므로 앱 용량이 가벼워집니다.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // src 폴더 내의 모든 자바스크립트 및 리액트 파일 포함
  ],
  
  theme: {
    // Tailwind의 기본 디자인 시스템에 우리 프로젝트만의 커스텀 설정을 '추가(extend)'하는 곳입니다.
    // 예: 피그마에 있는 메인 브랜드 컬러나 특정 폰트 사이즈를 여기에 등록해두면 
    // className="bg-primary" 처럼 쉽게 가져다 쓸 수 있습니다.
    extend: {},
  },
  
  // Tailwind 공식 플러그인(forms, typography 등)이나 외부 UI 라이브러리(예: daisyUI)를 
  // 프로젝트에 연동할 때 추가하는 배열입니다.
  plugins: [],
}
