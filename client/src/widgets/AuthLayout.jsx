import React from 'react';
/* FSD 계층 구조에 맞게 shared/ui 폴더의 컴포넌트들을 참조하도록 경로를 수정했습니다. */
import Card from '../shared/ui/Card';
import Logo from '../shared/ui/Logo';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-center min-h-[85vh] animate-fade-in py-10">
      <Card className="max-w-md w-full p-10 border-none shadow-2xl rounded-[2.5rem]">
        <div className="flex flex-col items-center mb-8 text-center">
          <Logo isDarkBg={false} />
          <h2 className="text-2xl font-black text-slate-900 mt-8 tracking-tight">{title}</h2>
          <p className="text-slate-500 mt-2 font-medium text-sm">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}