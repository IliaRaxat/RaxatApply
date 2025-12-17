'use client';

import { Resume } from '@/shared/types';

export function useResumeStatus(status: Resume['status']) {
  const getStatusColor = () => {
    const colors: Record<string, string> = {
      idle: 'bg-gray-100 text-gray-700',
      waiting_for_auth: 'bg-yellow-100 text-yellow-700',
      auth_completed: 'bg-green-100 text-green-700',
      parsing: 'bg-blue-100 text-blue-700',
      rating: 'bg-purple-100 text-purple-700',
      applying: 'bg-green-100 text-green-700',
      completed: 'bg-emerald-100 text-emerald-700',
      error: 'bg-red-100 text-red-700',
    };
    return colors[status] || colors.idle;
  };

  const getStatusText = () => {
    const texts: Record<string, string> = {
      idle: 'Готов к запуску',
      waiting_for_auth: '⏳ Ожидание авторизации в браузере...',
      auth_completed: '✅ Авторизация завершена',
      parsing: 'Парсинг вакансий...',
      rating: 'Рейтинг вакансий...',
      applying: 'Отправка откликов...',
      completed: 'Завершено',
      error: 'Ошибка',
    };
    return texts[status] || 'Неизвестно';
  };

  return { getStatusColor, getStatusText };
}
