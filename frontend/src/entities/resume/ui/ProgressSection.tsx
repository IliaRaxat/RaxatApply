'use client';

import { Resume } from '@/shared/types';
import { StatBox } from '@/shared/ui';

interface ProgressSectionProps {
  resume: Resume;
}

export function ProgressSection({ resume }: ProgressSectionProps) {
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
          style={{ width: `${Math.min(progress, 100)}%` }}
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
