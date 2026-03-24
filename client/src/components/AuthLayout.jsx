import React from 'react';
import Card from './Card';
import Logo from './Logo';

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