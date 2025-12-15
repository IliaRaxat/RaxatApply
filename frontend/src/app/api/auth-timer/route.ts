import { NextRequest, NextResponse } from 'next/server';
import { progressStore, updateProgress } from '@/lib/progressStore';

// Хранилище для таймеров авторизации
const authTimers = new Map<string, NodeJS.Timeout>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeId, action } = body;

    if (!resumeId) {
      return NextResponse.json({ error: 'resumeId обязателен' }, { status: 400 });
    }

    switch (action) {
      case 'start':
        // Запуск таймера авторизации на 5 минут (300 секунд)
        if (authTimers.has(resumeId)) {
          clearTimeout(authTimers.get(resumeId)!);
        }

        // Устанавливаем статус ожидания авторизации
        updateProgress(resumeId, {
          status: 'waiting_for_auth',
          parsed: 0,
          target: 0,
          applied: 0
        });

        const timer = setTimeout(() => {
          // По завершении таймера устанавливаем статус готовности к парсингу
          const current = progressStore.get(resumeId) || {};
          updateProgress(resumeId, {
            ...current,
            status: 'ready_for_parsing'
          });
          
          // Удаляем таймер из хранилища
          authTimers.delete(resumeId);
        }, 300000); // 5 минут в миллисекундах

        authTimers.set(resumeId, timer);

        return NextResponse.json({ 
          success: true, 
          message: 'Таймер авторизации запущен на 5 минут',
          resumeId 
        });

      case 'stop':
        // Остановка таймера авторизации
        if (authTimers.has(resumeId)) {
          clearTimeout(authTimers.get(resumeId)!);
          authTimers.delete(resumeId);
          
          // Обновляем статус
          const current = progressStore.get(resumeId) || {};
          updateProgress(resumeId, {
            ...current,
            status: 'auth_timer_stopped'
          });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Таймер авторизации остановлен',
          resumeId 
        });

      default:
        return NextResponse.json({ error: 'Неподдерживаемое действие' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Auth Timer API Error:', error);
    return NextResponse.json({ error: error.message || 'Внутренняя ошибка' }, { status: 500 });
  }
}