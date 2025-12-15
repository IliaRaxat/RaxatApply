'use client';

import { useState, useEffect } from 'react';
import { Resume } from '@/types';
import { startProcess } from '@/lib/api';

interface Props {
  resume: Resume;
  onUpdate: (id: string, updates: Partial<Resume>) => void;
  onDelete: (id: string) => void;
}

export default function ResumeCard({ resume, onUpdate, onDelete }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  // Установим значение по умолчанию 2000 для соответствия бэкенду
  const [vacancyCount, setVacancyCount] = useState<number>(resume.progress?.target || 2000);

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
        hhtoken: resume.hhtoken || '', // Токены могут быть пустыми
        xsrf: resume.xsrf || '',       // Токены могут быть пустыми
        geminiKey: resume.geminiKey,
        coverLetter: resume.coverLetter || '', // Добавляем coverLetter
        vacancyCount: vacancyCount,
      });

      // Используем polling для получения прогресса
      const pollProgress = async () => {
        try {
          const response = await fetch(`/api/progress/${resume.id}`);
          const data = await response.json();

          // Обновляем только если есть реальные данные
          const updates: Partial<Resume> = {};
          
          if (data.status && data.status !== 'idle') {
            updates.status = data.status;
          }
          
          if (data.parsed !== undefined || data.target !== undefined) {
            updates.progress = {
              parsed: data.parsed ?? 0,
              target: data.target ?? vacancyCount,
              applied: data.applied ?? 0,
              successCount: data.successCount ?? 0,
              failedCount: data.failedCount ?? 0,
              totalCount: data.totalCount ?? 0,
            };
          }
          
          if (data.topVacancies && data.topVacancies.length > 0) {
            updates.topVacancies = data.topVacancies;
          }

          if (Object.keys(updates).length > 0) {
            onUpdate(resume.id, updates);
          }

          // Останавливаем polling при завершении
          if (data.status === 'completed' || data.status === 'error') {
            setIsRunning(false);
            return;
          }

          // Продолжаем polling каждые 500ms
          setTimeout(pollProgress, 500);
        } catch (error) {
          console.error('Polling error:', error);
          // При ошибке продолжаем polling
          setTimeout(pollProgress, 1000);
        }
      };

      // Запускаем polling
      pollProgress();
    } catch (error: any) {
      setIsRunning(false);
      onUpdate(resume.id, {
        status: 'error',
        error: error.message || 'Ошибка запуска',
      });
    }
  };

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
    return colors[resume.status] || colors.idle;
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
    return texts[resume.status] || 'Неизвестно';
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          {(resume.status === 'parsing' || resume.status === 'rating' || resume.status === 'waiting_for_auth') && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              <span className="text-sm text-gray-600 font-semibold">
                {resume.status === 'waiting_for_auth' 
                  ? 'Войдите в аккаунт HH.ru в браузере' 
                  : `${(resume.progress?.parsed ?? 0)} / ${(resume.progress?.target ?? vacancyCount)}`
                }
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <InputField
          label="HH Token (опционально)"
          value={resume.hhtoken}
          onChange={v => onUpdate(resume.id, { hhtoken: v })}
          disabled={resume.status !== 'idle'}
          placeholder="Оставьте пустым для ручной авторизации"
        />
        <InputField
          label="XSRF Token (опционально)"
          value={resume.xsrf}
          onChange={v => onUpdate(resume.id, { xsrf: v })}
          disabled={resume.status !== 'idle'}
          placeholder="Оставьте пустым для ручной авторизации"
        />
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

      <div className="flex gap-4">
        <button
          onClick={handleStart}
          disabled={isRunning || resume.status !== 'idle' || !resume.geminiKey}
          className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isRunning || resume.status !== 'idle' ? 'Выполняется...' : 'Запустить'}
        </button>
        {(resume.status !== 'idle' || isRunning) && (
          <button
            onClick={() => {
              setIsRunning(false);
              onUpdate(resume.id, { 
                status: 'idle', 
                error: undefined,
                progress: { parsed: 0, target: 2000, applied: 0 },
                topVacancies: []
              });
            }}
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

function InputField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        disabled={disabled}
      />
    </div>
  );
}

function ProgressSection({ resume }: { resume: Resume }) {
  const progress = (resume.progress.parsed / resume.progress.target) * 100;

  return (
    <div className="mt-6">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>Прогресс</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {resume.status === 'applying' && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <StatBox value={resume.progress.applied || 0} label="Обработано" color="blue" />
          <StatBox value={resume.progress.successCount || 0} label="Успешно" color="green" />
          <StatBox value={resume.progress.failedCount || 0} label="Ошибок" color="red" />
        </div>
      )}
    </div>
  );
}

function StatBox({ value, label, color }: { value: number; label: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className={`p-3 rounded-lg ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}

function VacanciesList({
  vacancies,
  isExpanded,
  onToggle,
}: {
  vacancies: any[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-6">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left font-semibold text-gray-800 mb-4"
      >
        <span>Топ вакансий ({vacancies.length})</span>
        <svg
          className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {vacancies.map(vacancy => (
            <div
              key={vacancy.vacancy_id}
              className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-800">{vacancy.title}</h4>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {vacancy.relevance_score}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-1">{vacancy.company}</p>
              {vacancy.salary && <p className="text-sm text-green-600 font-medium">{vacancy.salary}</p>}
              <a
                href={vacancy.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:text-blue-700 mt-2 inline-block"
              >
                Открыть вакансию →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
