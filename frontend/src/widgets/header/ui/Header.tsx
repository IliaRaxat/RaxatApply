'use client';

import { User } from '@/shared/lib/auth';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="
          flex items-center justify-between
          px-8 py-4
          bg-white/5 backdrop-blur-2xl
          border border-white/10
          rounded-2xl
          shadow-[0_8px_32px_rgba(0,0,0,0.3)]
        ">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="
              w-10 h-10 rounded-xl
              bg-gradient-to-br from-violet-500 to-fuchsia-600
              flex items-center justify-center
              shadow-lg shadow-violet-500/30
            ">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Raxat Auto Apply
              </h1>
              <p className="text-xs text-gray-500">Автоматизация откликов</p>
            </div>
          </div>

          {/* User */}
          <div className="flex items-center gap-4">
            <div className="
              flex items-center gap-3 px-4 py-2
              bg-white/5 backdrop-blur-sm
              rounded-xl border border-white/10
            ">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-gray-300 font-medium">{user.email}</span>
            </div>
            
            <button
              onClick={onLogout}
              className="
                px-4 py-2
                text-gray-400 hover:text-red-400
                bg-white/5 hover:bg-red-500/10
                backdrop-blur-sm
                rounded-xl border border-white/10 hover:border-red-500/30
                transition-all duration-300
                text-sm font-medium
              "
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
