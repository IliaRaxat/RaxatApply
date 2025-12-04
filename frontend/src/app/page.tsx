'use client';

import { useState } from 'react';
import ResumeCard from '@/components/ResumeCard';
import { Resume } from '@/types';

const DEFAULT_RESUMES: Resume[] = [
  {
    id: '1',
    hhtoken: 'htOnjNQOTRdz_3u1mOs_429ZBsIz',
    xsrf: '542c53b2e77ebcfd19b96b024ac0208d',
    geminiKey: 'AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik',
    status: 'idle',
    progress: { parsed: 0, target: 1000, applied: 0 },
    topVacancies: [],
  },
  {
    id: '2',
    hhtoken: 'KCDUJriJp1fI5OzhSdfYWbsyC45j',
    xsrf: '542c53b2e77ebcfd19b96b024ac0208d',
    geminiKey: 'AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik',
    status: 'idle',
    progress: { parsed: 0, target: 1000, applied: 0 },
    topVacancies: [],
  },
  {
    id: '3',
    hhtoken: 'fF4yzUgipZpcobm1t16JwHbQSctU',
    xsrf: '542c53b2e77ebcfd19b96b024ac0208d',
    geminiKey: 'AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik',
    status: 'idle',
    progress: { parsed: 0, target: 1000, applied: 0 },
    topVacancies: [],
  },
];

export default function Home() {
  const [resumes, setResumes] = useState<Resume[]>(DEFAULT_RESUMES);

  const addResume = () => {
    const newResume: Resume = {
      id: Date.now().toString(),
      hhtoken: '',
      xsrf: '',
      geminiKey: 'AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik',
      status: 'idle',
      progress: { parsed: 0, target: 1000, applied: 0 },
      topVacancies: [],
    };
    setResumes([...resumes, newResume]);
  };

  const updateResume = (id: string, updates: Partial<Resume>) => {
    setResumes(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              ...updates,
              progress: updates.progress ? { ...updates.progress } : r.progress,
            }
          : r
      )
    );
  };

  const deleteResume = (id: string) => {
    setResumes(resumes.filter(r => r.id !== id));
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            HH Auto Apply
          </h1>
          <p className="text-gray-600 text-lg">
            Автоматизация откликов на вакансии HH.ru
          </p>
        </header>

        <div className="space-y-6">
          {resumes.map(resume => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              onUpdate={updateResume}
              onDelete={deleteResume}
            />
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={addResume}
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            + Добавить резюме
          </button>
        </div>
      </div>
    </main>
  );
}
