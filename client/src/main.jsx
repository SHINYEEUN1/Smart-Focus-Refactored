// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 💡 1. 페이지 이동 기능(라우터)을 쓰기 위해 BrowserRouter를 불러옵니다.
import { BrowserRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 💡 2. App 컴포넌트를 BrowserRouter로 감싸줍니다. 
        이제 App 안의 모든 페이지(Report, Dashboard 등)에서 자유롭게 이동할 수 있습니다! */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)