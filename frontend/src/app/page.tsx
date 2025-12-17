'use client';

import { useState } from 'react';
import ResumeCard from '@/components/ResumeCard';
import { Resume } from '@/types';

const DEFAULT_COVER_LETTER = `Здравствуйте!

Меня зовут Илья, я frontend-разработчик с более чем 4 годами опыта работы в финтехе и high-load проектах. В своей работе я уделяю особое внимание стабильности продукта, удобству интерфейсов и оптимизации производительности.

За время работы я разрабатывал и улучшал пользовательские интерфейсы для систем с высокой нагрузкой, автоматизировал процессы и внедрял решения, повышающие эффективность бизнеса. Хорошо понимаю, как строить удобные и масштабируемые продукты, и умею работать как в команде, так и самостоятельно.

Я открыт к новым вызовам и уверен, что мой опыт и навыки будут полезны вашей компании. Буду рад обсудить детали и ответить на вопросы на собеседовании.

Спасибо за внимание к моей кандидатуре.

С уважением,
Илья`;

const DEFAULT_RESUMES: Resume[] = [
  {
    id: '1',
    hhtoken: '', // Токены теперь будут получены автоматически
    xsrf: '',    // Токены теперь будут получены автоматически
    geminiKey: 'AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik',
    coverLetter: DEFAULT_COVER_LETTER,
    status: 'idle',
    progress: { parsed: 0, target: process.env.NEXT_PUBLIC_TEST_MODE === 'true' ? 30 : 5000, applied: 0 },
    topVacancies: [],
  },
  {
    id: '2',
    hhtoken: '', // Токены теперь будут получены автоматически
    xsrf: '',    // Токены теперь будут получены автоматически
    geminiKey: 'AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik',
    coverLetter: DEFAULT_COVER_LETTER,
    status: 'idle',
    progress: { parsed: 0, target: process.env.NEXT_PUBLIC_TEST_MODE === 'true' ? 30 : 5000, applied: 0 },
    topVacancies: [],
  },
  {
    id: '3',
    hhtoken: '', // Токены теперь будут получены автоматически
    xsrf: '',    // Токены теперь будут получены автоматически
    geminiKey: 'AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik',
    coverLetter: DEFAULT_COVER_LETTER,
    status: 'idle',
    progress: { parsed: 0, target: process.env.NEXT_PUBLIC_TEST_MODE === 'true' ? 30 : 5000, applied: 0 },
    topVacancies: [],
  },
];

export default function Home() {
  const [resumes, setResumes] = useState<Resume[]>(DEFAULT_RESUMES);

  const addResume = () => {
    const newResume: Resume = {
      id: Date.now().toString(),
      hhtoken: '', // Токены теперь будут получены автоматически
      xsrf: '',    // Токены теперь будут получены автоматически
      geminiKey: 'AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik',
      coverLetter: DEFAULT_COVER_LETTER,
      status: 'idle',
      progress: { parsed: 0, target: process.env.NEXT_PUBLIC_TEST_MODE === 'true' ? 30 : 5000, applied: 0 },
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
          {/* Убрано назойливое сообщение о режиме */}
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