'use client';

import { useState, useEffect } from 'react';
import { Resume } from '@/shared/types';
import { startProcess } from '@/shared/api';
import { InputField } from '@/shared/ui';
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
      onUpdate(resume.id, {
        status: 'error',
        error: error.message || 'Ошибка запуска',
      });
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

  const showSpinner = resume.status === 'parsing' || 
                      resume.status === 'rating' || 
                      resume.status === 'waiting_for_auth' || 
                      resume.status === 'applying';

  const getProgressText = () => {
    if (resume.status === 'waiting_for_auth') {
      return 'Войдите в аккаунт HH.ru в браузере';
    }
    if (resume.status === 'applying') {
      return `Отклики: ${resume.progress?.applied ?? 0} / ${resume.progress?.parsed ?? 0}`;
    }
    return `Парсинг: ${resume.progress?.parsed ?? 0} / ${resume.progress?.target ?? vacancyCount}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          {showSpinner && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              <span className="text-sm text-gray-600 font-semibold">
                {getProgressText()}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(resume.id)}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <InputField
          label="Gemini API Key *"
          value={resume.geminiKey}
          onChange={v => onUpdate(resume.id, { geminiKey: v })}
          disabled={resume.status !== 'idle'}
          placeholder="AIzaSyAMmvC..."
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Количество вакансий</label>
          <input
            type="number"
            value={vacancyCount}
            onChange={e => setVacancyCount(parseInt(e.target.value) || 100)}
            min={10}
            max={10000}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={resume.status !== 'idle'}
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Сопроводительное письмо
        </label>
        <textarea
          value={resume.coverLetter}
          onChange={e => onUpdate(resume.id, { coverLetter: e.target.value })}
          placeholder="Здравствуйте! Меня заинтересовала ваша вакансия..."
          rows={5}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          disabled={resume.status !== 'idle'}
        />
        <p className="text-xs text-gray-500 mt-1">
          Используется для вакансий с обязательным сопроводительным письмом
        </p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleStart}
          disabled={isRunning || resume.status !== 'idle'}
          className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isRunning || resume.status !== 'idle' ? 'Выполняется...' : 'Запустить'}
        </button>
        {(resume.status !== 'idle' || isRunning) && (
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg font-semibold shadow-md hover:bg-gray-600 transition-all duration-200"
          >
            Сбросить
          </button>
        )}
      </div>

      {resume.error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {resume.error}
        </div>
      )}

      {resume.status !== 'idle' && resume.status !== 'error' && (
        <ProgressSection resume={resume} />
      )}

      {resume.topVacancies.length > 0 && (
        <VacanciesList
          vacancies={resume.topVacancies}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
      )}
    </div>
  );
}
