'use client';

import { useState, useEffect, useRef } from 'react';
import { Resume } from '@/shared/types';
import { startProcess } from '@/shared/api';
import { ProgressSection, useResumeStatus } from '@/entities/resume';
import { VacanciesList } from '@/entities/vacancy';
import { useProcessPolling } from '@/features/start-process';

interface ResumeCardProps {
  resume: Resume;
  onUpdate: (id: string, updates: Partial<Resume>) => void;
  onDelete: (id: string) => void;
}

export function ResumeCard({ resume, onUpdate, onDelete }: ResumeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [vacancyCount, setVacancyCount] = useState<number>(resume.progress?.target || 4000);
  const pollingStartedRef = useRef(false);

  const { getStatusColor, getStatusText } = useResumeStatus(resume.status);

  const { startPolling, stopPolling } = useProcessPolling({
    resumeId: resume.id,
    vacancyCount,
    onUpdate,
    onComplete: () => {
      pollingStartedRef.current = false;
    },
  });

  // Статусы
  const isProcessActive = ['parsing', 'rating', 'applying', 'waiting_for_auth', 'auth_completed'].includes(resume.status);
  const isHHAuthorized = !!(resume.hhtoken && resume.xsrf) || resume.status === 'auth_completed';
  const hasBrowserProfile = resume.hasBrowserProfile && !isHHAuthorized;

  // Автоматически запускаем polling когда статус активный
  useEffect(() => {
    console.log(`[ResumeCard ${resume.id}] isProcessActive=${isProcessActive}, pollingStarted=${pollingStartedRef.current}`);
    
    if (isProcessActive && !pollingStartedRef.current) {
      console.log(`[ResumeCard ${resume.id}] Starting polling...`);
      pollingStartedRef.current = true;
      startPolling();
    }
    
    if (!isProcessActive && pollingStartedRef.current) {
      console.log(`[ResumeCard ${resume.id}] Stopping polling...`);
      pollingStartedRef.current = false;
      stopPolling();
    }
  }, [isProcessActive]); // Убрал startPolling, stopPolling из зависимостей

  // Раскрываем вакансии когда появляются
  useEffect(() => {
    if (resume.topVacancies.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [resume.topVacancies.length, isExpanded]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleStart = async () => {
    if (isProcessActive) return;

    try {
      // Сразу устанавливаем статус и начальный прогресс
      onUpdate(resume.id, { 
        status: 'parsing', 
        error: undefined,
        progress: { parsed: 0, target: vacancyCount, applied: 0 }
      });
      
      await startProcess({
        resumeId: resume.id,
        hhtoken: resume.hhtoken || '',
        xsrf: resume.xsrf || '',
        geminiKey: resume.geminiKey,
        coverLetter: resume.coverLetter || '',
        vacancyCount: vacancyCount,
      });
      
      pollingStartedRef.current = true;
      startPolling();
    } catch (error: any) {
      onUpdate(resume.id, { status: 'error', error: error.message || 'Ошибка запуска' });
    }
  };

  const handleReset = async () => {
    stopPolling();
    pollingStartedRef.current = false;
    
    // Очищаем прогресс на сервере
    try {
      await fetch(`/api/progress/${resume.id}`, { method: 'DELETE' });
    } catch (e) {}
    
    onUpdate(resume.id, { 
      status: 'idle', 
      error: undefined,
      progress: { parsed: 0, target: 4000, applied: 0 },
      topVacancies: []
    });
  };

  const getProgressText = () => {
    const parsed = resume.progress?.parsed ?? 0;
    const target = resume.progress?.target ?? vacancyCount;
    
    if (resume.status === 'waiting_for_auth') return 'Войдите в HH.ru в браузере';
    if (resume.status === 'auth_completed') return 'Авторизация успешна...';
    if (resume.status === 'rating') return 'Сортировка вакансий...';
    if (resume.status === 'applying') return `Отклики: ${resume.progress?.applied ?? 0}`;
    return `${parsed} / ${target}`;
  };

  return (
    <div className="relative overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rounded-3xl" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
              <span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Резюме #{resume.id}
              </span>
            </div>
            
            {/* Статус авторизации */}
            <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              isHHAuthorized 
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                : hasBrowserProfile
                  ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                  : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
            }`}>
              {isHHAuthorized ? '✓ Авторизован' : hasBrowserProfile ? '◎ Профиль есть' : '○ Нужен вход'}
            </div>
            
            {/* Статус процесса + прогресс */}
            {isProcessActive && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 rounded-xl border border-violet-500/30">
                <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-violet-300 font-medium">{getProgressText()}</span>
              </div>
            )}
            
            {resume.status === 'completed' && (
              <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                ✓ Завершено
              </div>
            )}
            
            {resume.status === 'error' && (
              <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/20 border border-red-500/30 text-red-400">
                ✕ Ошибка
              </div>
            )}
          </div>
          
          <button onClick={() => onDelete(resume.id)} className="p-2 rounded-xl text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/20 border border-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Gemini API Key</label>
            <input
              type="text"
              value={resume.geminiKey}
              onChange={e => onUpdate(resume.id, { geminiKey: e.target.value })}
              disabled={isProcessActive}
              placeholder="AIzaSyAMmvC..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Количество вакансий</label>
            <input
              type="number"
              value={vacancyCount}
              onChange={e => setVacancyCount(parseInt(e.target.value) || 100)}
              min={10}
              max={10000}
              disabled={isProcessActive}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">Сопроводительное письмо</label>
          <textarea
            value={resume.coverLetter}
            onChange={e => onUpdate(resume.id, { coverLetter: e.target.value })}
            placeholder="Здравствуйте!..."
            rows={4}
            disabled={isProcessActive}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 resize-y"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleStart}
            disabled={isProcessActive}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessActive ? 'Выполняется...' : '🚀 Запустить'}
          </button>
          
          {(isProcessActive || resume.status === 'completed' || resume.status === 'error') && (
            <button onClick={handleReset} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold rounded-2xl border border-white/10">
              Сбросить
            </button>
          )}
        </div>

        {/* Error */}
        {resume.error && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-red-400 text-sm">
            {resume.error}
          </div>
        )}

        {/* Progress */}
        {isProcessActive && <div className="mt-6"><ProgressSection resume={resume} /></div>}

        {/* Vacancies */}
        {resume.topVacancies.length > 0 && (
          <div className="mt-6">
            <VacanciesList vacancies={resume.topVacancies} isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} />
          </div>
        )}
      </div>
    </div>
  );
}
