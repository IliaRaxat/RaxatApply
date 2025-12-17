'use client';

import { Vacancy } from '@/shared/types';

interface VacancyCardProps {
  vacancy: Vacancy;
}

export function VacancyCard({ vacancy }: VacancyCardProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
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
  );
}
