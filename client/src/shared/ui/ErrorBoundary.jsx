import React from 'react';

/**
 * 전역 에러 바운더리 컴포넌트
 * 하위 컴포넌트 트리에서 발생하는 런타임 에러를 포착하여 서비스 중단을 방지함
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /* 에러 발생 시 상태 업데이트 */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /* 에러 로그 기록 */
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary 포착 에러:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      /* 에러 발생 시 노출될 폴백 UI */
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white p-10 rounded-3xl border border-slate-100 shadow-xl text-center">
            <div className="text-6xl mb-6">🛠️</div>
            <h2 className="text-2xl font-black text-slate-900 mb-3">잠시 문제가 발생했습니다</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
              데이터를 처리하는 중 일시적인 오류가 발생했습니다.<br />
              페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-100"
            >
              페이지 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;