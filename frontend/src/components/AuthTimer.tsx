'use client';

import { useState, useEffect } from 'react';

interface AuthTimerProps {
  resumeId: string;
  onTimerComplete: () => void;
}

export default function AuthTimer({ resumeId, onTimerComplete }: AuthTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 минут в секундах
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsActive(false);
            onTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, onTimerComplete]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
          ⏳ Ожидание авторизации
        </h3>
        <p className="text-yellow-700 mb-4">
          У вас есть 5 минут для авторизации в аккаунте HH.ru
        </p>
        
        <div className="mb-4">
          <div className="text-3xl font-bold text-yellow-600">
            {formatTime(timeLeft)}
          </div>
          <div className="text-sm text-yellow-600 mt-1">
            осталось времени
          </div>
        </div>
        
        <div className="w-full bg-yellow-200 rounded-full h-2.5 mb-4">
          <div 
            className="bg-yellow-600 h-2.5 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${((300 - timeLeft) / 300) * 100}%` }}
          ></div>
        </div>
        
        <p className="text-sm text-yellow-700">
          После завершения таймера начнется парсинг вакансий
        </p>
      </div>
    </div>
  );
}