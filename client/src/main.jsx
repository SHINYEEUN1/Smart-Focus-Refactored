// 리액트 핵심 라이브러리
import React from 'react'
// 리액트 코드를 실제 웹 브라우저 화면(HTML)에 그려주는 렌더링 도구
import ReactDOM from 'react-dom/client'
// 우리가 만든 최상위 메인 화면 (대시보드, 네비게이션 등 모든 UI가 포함됨)
import App from './App'
// Tailwind 설정이 들어있는 전체 공통 스타일 시트
import './index.css' 

// index.html 파일에 있는 <div id="root"></div> 빈 껍데기를 찾아서
// 그 안에 우리의 리액트 앱(<App />)을 화면에 렌더링(출력)합니다.
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode: 개발 환경에서 잠재적인 버그를 찾기 위해 
  // 코드를 의도적으로 두 번씩 실행해보는 안전장치입니다. (실제 서비스 배포 시에는 무시됨)
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)