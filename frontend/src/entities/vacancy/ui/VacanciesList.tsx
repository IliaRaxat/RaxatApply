'use client';

import { Vacancy } from '@/shared/types';
import { VacancyCard } from './VacancyCard';

interface VacanciesListProps {
  vacancies: Vacancy[];
  isExpanded: boolean;
  onToggle: () => void;
}

export function VacanciesList({ vacancies, isExpanded, onToggle }: VacanciesListProps) {
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
            <VacancyCard key={vacancy.vacancy_id} vacancy={vacancy} />
          ))}
        </div>
      )}
    </div>
  );
}
