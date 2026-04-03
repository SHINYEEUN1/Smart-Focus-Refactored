import React from 'react';

/**
 * 전역 런타임 에러 핸들러 컴포넌트
 * 애플리케이션의 치명적인 오류를 감지하고 사용자 친화적인 복구 화면을 제공합니다.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    /* 다음 렌더링에서 폴백 UI가 보이도록 상태를 업데이트합니다. */
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    /* 에러 로깅 서비스(예: Sentry)에 에러를 기록할 수 있는 영역입니다. */
    console.error("Uncaught Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      /* 에러 발생 시 노출되는 프리미엄 폴백 UI */
      return (
        <div className="flex items-center justify-center min-h-screen p-6 bg-[#f8fafc] font-sans">
          <div className="max-w-xl w-full text-center p-12 bg-white border border-slate-200 shadow-2xl rounded-[2.5rem] animate-fade-in">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">예기치 못한 오류가 발생했습니다</h1>
            <p className="text-slate-500 font-semibold mb-10 leading-relaxed break-keep">
              일시적인 통신 장애이거나 시스템 오류일 수 있습니다.<br/>
              페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()} 
                className="w-full py-4 bg-[#5B44F2] text-white rounded-2xl font-black shadow-lg hover:bg-[#4a36c4] active:scale-95 transition-all"
              >
                페이지 새로고침
              </button>
              <button 
                onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }} 
                className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
              >
                메인 화면으로 이동
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;