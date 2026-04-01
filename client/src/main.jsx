import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

/* FSD 구조에 따라 app 계층으로 이동된 App 컴포넌트를 참조합니다. */
import App from './app/App';
/* 수정된 전역 스타일 파일을 최상단에서 불러옵니다. */
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* useNavigate 등 라우팅 기능을 앱 전체에 공급하기 위해 최상위에서 감싸줍니다. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);