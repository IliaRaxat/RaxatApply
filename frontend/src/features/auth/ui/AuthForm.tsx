'use client';

import { useState } from 'react';
import { setToken, setUser, User } from '@/shared/lib/auth';

interface AuthFormProps {
  onSuccess: (user: User) => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка авторизации');
      }

      setToken(data.token);
      setUser(data.user);
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-purple-100 p-6">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      <div className="
        relative w-full max-w-md
        bg-white/25 backdrop-blur-2xl
        border border-white/30
        rounded-3xl
        shadow-[0_8px_32px_rgba(0,0,0,0.1)]
        p-8
      ">
        {/* Glass reflection */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none rounded-3xl" />
        
        <div className="relative z-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="
              w-16 h-16 mx-auto mb-4 rounded-2xl
              bg-gradient-to-br from-blue-500 to-purple-600
              flex items-center justify-center
              shadow-lg shadow-blue-500/30
            ">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              HH Auto Apply
            </h1>
            <p className="text-gray-500 mt-2">
              {isLogin ? 'Войдите в аккаунт' : 'Создайте аккаунт'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="
                  w-full px-4 py-3
                  bg-white/40 backdrop-blur-sm
                  border border-white/30
                  rounded-2xl
                  text-gray-800 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-300/50
                  transition-all duration-300
                "
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="
                  w-full px-4 py-3
                  bg-white/40 backdrop-blur-sm
                  border border-white/30
                  rounded-2xl
                  text-gray-800 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-300/50
                  transition-all duration-300
                "
                placeholder={isLogin ? '••••••••' : 'Минимум 6 символов'}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="
                p-4
                bg-red-500/10 backdrop-blur-sm
                border border-red-300/30
                rounded-2xl
                text-red-700 text-sm
              ">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="
                w-full py-3.5
                bg-gradient-to-r from-blue-500 to-purple-500
                hover:from-blue-600 hover:to-purple-600
                text-white font-semibold
                rounded-2xl
                shadow-lg shadow-blue-500/25
                hover:shadow-xl hover:shadow-blue-500/30
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                transform hover:scale-[1.02] active:scale-[0.98]
                transition-all duration-300
              "
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Загрузка...
                </span>
              ) : (
                isLogin ? 'Войти' : 'Зарегистрироваться'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
            >
              {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
