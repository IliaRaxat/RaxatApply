'use client';

import { useState, useEffect } from 'react';
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
  const [isRunning, setIsRunning] = useState(false);
  const [vacancyCount, setVacancyCount] = useState<number>(resume.progress?.target || 4000);

  const { getStatusColor, getStatusText } = useResumeStatus(resume.status);

  const { startPolling } = useProcessPolling({
    resumeId: resume.id,
    vacancyCount,
    onUpdate,
    onComplete: () => setIsRunning(false),
  });

  useEffect(() => {
    if (resume.topVacancies.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [resume.topVacancies.length, isExpanded]);

  const handleStart = async () => {
    if (isRunning || resume.status !== 'idle') return;
    setIsRunning(true);

    try {
      onUpdate(resume.id, { status: 'parsing', error: undefined });
      await startProcess({
        resumeId: resume.id,
        hhtoken: resume.hhtoken || '',
        xsrf: resume.xsrf || '',
        geminiKey: resume.geminiKey,
        coverLetter: resume.coverLetter || '',
        vacancyCount: vacancyCount,
      });
      startPolling();
    } catch (error: any) {
      setIsRunning(false);
      onUpdate(resume.id, { status: 'error', error: error.message || 'Ошибка запуска' });
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    onUpdate(resume.id, { 
      status: 'idle', 
      error: undefined,
      progress: { parsed: 0, target: 4000, applied: 0 },
      topVacancies: []
    });
  };

  const isHHAuthorized = !!(resume.hhtoken && resume.xsrf);
  const hhDisplayName = resume.hhUserName || resume.hhUserEmail || null;

  const showSpinner = resume.status === 'parsing' || 
                      resume.status === 'rating' || 
                      resume.status === 'waiting_for_auth' || 
                      resume.status === 'applying';

  const getProgressText = () => {
    if (resume.status === 'waiting_for_auth') return 'Войдите в HH.ru в браузере';
    if (resume.status === 'applying') return `Отклики: ${resume.progress?.applied ?? 0} / ${resume.progress?.parsed ?? 0}`;
    return `Парсинг: ${resume.progress?.parsed ?? 0} / ${resume.progress?.target ?? vacancyCount}`;
  };

  return (
    <div className="
      relative overflow-hidden
      bg-white/5 backdrop-blur-2xl
      border border-white/10
      rounded-3xl
      shadow-[0_8px_32px_rgba(0,0,0,0.3)]
      hover:shadow-[0_16px_48px_rgba(0,0,0,0.4)]
      hover:border-white/20
      transition-all duration-500
      p-6
    ">
      {/* Glass reflection */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rounded-3xl" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="
              px-4 py-2 rounded-2xl
              bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20
              border border-violet-500/30
              backdrop-blur-sm
            ">
              <span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Резюме #{resume.id}
              </span>
            </div>
            
            <div className={`
              px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-sm border
              ${isHHAuthorized 
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
              }
            `}>
              {isHHAuthorized ? `✓ ${hhDisplayName || 'HH авторизован'}` : '○ Требуется вход'}
            </div>
            
            <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-sm border ${getStatusColor()}`}>
              {getStatusText()}
            </div>
            
            {showSpinner && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 rounded-xl border border-violet-500/30">
                <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-violet-300 font-medium">{getProgressText()}</span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => onDelete(resume.id)}
            className="
              p-2 rounded-xl
              text-gray-500 hover:text-red-400
              bg-white/5 hover:bg-red-500/20
              border border-white/10 hover:border-red-500/30
              backdrop-blur-sm
              transition-all duration-300
            "
          >
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
              disabled={resume.status !== 'idle'}
              placeholder="AIzaSyAMmvC..."
              className="
                w-full px-4 py-3
                bg-white/5 backdrop-blur-sm
                border border-white/10
                rounded-2xl
                text-gray-200 placeholder-gray-600
                focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-300
              "
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
              className="
                w-full px-4 py-3
                bg-white/5 backdrop-blur-sm
                border border-white/10
                rounded-2xl
                text-gray-200
                focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-300
              "
              disabled={resume.status !== 'idle'}
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">Сопроводительное письмо</label>
          <textarea
            value={resume.coverLetter}
            onChange={e => onUpdate(resume.id, { coverLetter: e.target.value })}
            placeholder="Здравствуйте! Меня заинтересовала ваша вакансия..."
            rows={4}
            className="
              w-full px-4 py-3
              bg-white/5 backdrop-blur-sm
              border border-white/10
              rounded-2xl
              text-gray-200 placeholder-gray-600
              focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50
              disabled:opacity-50 disabled:cursor-not-allowed
              resize-y
              transition-all duration-300
            "
            disabled={resume.status !== 'idle'}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleStart}
            disabled={isRunning || resume.status !== 'idle'}
            className="
              flex-1 py-3 px-6
              bg-gradient-to-r from-violet-600 to-fuchsia-600
              hover:from-violet-500 hover:to-fuchsia-500
              text-white font-semibold
              rounded-2xl
              shadow-lg shadow-violet-500/25
              hover:shadow-xl hover:shadow-violet-500/40
              disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
              transform hover:scale-[1.02] active:scale-[0.98]
              transition-all duration-300
            "
          >
            {isRunning || resume.status !== 'idle' ? 'Выполняется...' : '🚀 Запустить'}
          </button>
          
          {(resume.status !== 'idle' || isRunning) && (
            <button
              onClick={handleReset}
              className="
                px-6 py-3
                bg-white/5 hover:bg-white/10
                backdrop-blur-sm
                text-gray-300 font-semibold
                rounded-2xl
                border border-white/10
                transition-all duration-300
              "
            >
              Сбросить
            </button>
          )}
        </div>

        {/* Error */}
        {resume.error && (
          <div className="mt-4 p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-2xl text-red-400 text-sm">
            {resume.error}
          </div>
        )}

        {/* Progress */}
        {resume.status !== 'idle' && resume.status !== 'error' && (
          <div className="mt-6"><ProgressSection resume={resume} /></div>
        )}

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
