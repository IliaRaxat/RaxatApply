'use client';

import { Resume } from '@/shared/types';

export function useResumeStatus(status: Resume['status']) {
  const getStatusColor = () => {
    const colors: Record<string, string> = {
      idle: 'bg-gray-500/10 border-gray-300/30 text-gray-600',
      waiting_for_auth: 'bg-amber-500/10 border-amber-300/30 text-amber-700',
      auth_completed: 'bg-emerald-500/10 border-emerald-300/30 text-emerald-700',
      parsing: 'bg-blue-500/10 border-blue-300/30 text-blue-700',
      rating: 'bg-purple-500/10 border-purple-300/30 text-purple-700',
      applying: 'bg-cyan-500/10 border-cyan-300/30 text-cyan-700',
      completed: 'bg-emerald-500/10 border-emerald-300/30 text-emerald-700',
      error: 'bg-red-500/10 border-red-300/30 text-red-700',
    };
    return colors[status] || colors.idle;
  };

  const getStatusText = () => {
    const texts: Record<string, string> = {
      idle: '○ Готов',
      waiting_for_auth: '⏳ Ожидание входа в HH',
      auth_completed: '✓ Авторизован',
      parsing: '◐ Парсинг...',
      rating: '◑ Рейтинг...',
      applying: '◒ Отклики...',
      completed: '✓ Завершено',
      error: '✕ Ошибка',
    };
    return texts[status] || 'Неизвестно';
  };

  return { getStatusColor, getStatusText };
}
