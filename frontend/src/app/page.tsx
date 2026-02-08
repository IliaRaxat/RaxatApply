'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResumeCard } from '@/widgets/resume-card';
import { Header } from '@/widgets/header';
import { AuthForm } from '@/features/auth';
import { Resume } from '@/shared/types';
import { getToken, getUser, logout, User, authFetch } from '@/shared/lib/auth';

const DEFAULT_COVER_LETTER = `Добрый день!

Меня заинтересовала ваша вакансия, так как мой опыт идеально ложится в задачи по развитию высоконагруженных фронтенд-систем.

Почему стоит обратить внимание на мой профиль:

• Масштабирование: В Альфа-Банке я успешно перевел платформу со 130k+ пользователей на стек Next.js (RSC), что позволило ускорить TTI с 4.5с до 1.2с без остановки бизнес-процессов.

• Сложный UI: Имею опыт разработки интерактивных модулей на чистом Canvas API и WebSockets (реализовал систему бронирования мест в реальном времени), где стандартные React-библиотеки не справлялись с нагрузкой.

• Бизнес-подход: Умею превращать размытые требования в четкую архитектуру, фокусируясь на производительности (Core Web Vitals) и быстрой доставке фич.

Готов оперативно созвониться, чтобы обсудить, как мой опыт работы в финтехе и со сложной графикой поможет вашей команде.`;

function createDefaultResume(slot: number): Resume {
  return {
    id: String(slot),
    hhtoken: '',
    xsrf: '',
    geminiKey: '',
    coverLetter: DEFAULT_COVER_LETTER,
    status: 'idle',
    progress: { parsed: 0, target: 4000, applied: 0 },
    topVacancies: [],
  };
}

function createDefaultResumes(): Resume[] {
  return [1, 2, 3, 4].map(slot => createDefaultResume(slot));
}

interface SavedResume {
  resume_slot: number;
  cookies: string | null;
  hh_user_name: string | null;
  hh_user_email: string | null;
  gemini_key: string | null;
  cover_letter: string | null;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resumes, setResumes] = useState<Resume[]>(createDefaultResumes());

  const loadSavedResumes = useCallback(async () => {
    try {
      const response = await authFetch('/api/resumes');
      if (response.ok) {
        const data = await response.json();
        const savedResumes: SavedResume[] = data.resumes || [];
        const newResumes = createDefaultResumes();
        
        // Загружаем информацию о профилях браузера
        let browserProfiles: Record<string, boolean> = {};
        try {
          const profilesResponse = await fetch('/api/check-profiles');
          if (profilesResponse.ok) {
            const profilesData = await profilesResponse.json();
            browserProfiles = profilesData.profiles || {};
          }
        } catch (e) {
          console.error('Failed to load browser profiles:', e);
        }
        
        savedResumes.forEach((saved: SavedResume) => {
          const index = saved.resume_slot - 1;
          if (index >= 0 && index < newResumes.length) {
            if (saved.cookies) {
              try {
                const cookiesData = JSON.parse(saved.cookies);
                newResumes[index].hhtoken = cookiesData.hhtoken || '';
                newResumes[index].xsrf = cookiesData.xsrf || '';
              } catch {}
            }
            if (saved.hh_user_name) newResumes[index].hhUserName = saved.hh_user_name;
            if (saved.hh_user_email) newResumes[index].hhUserEmail = saved.hh_user_email;
            if (saved.gemini_key) newResumes[index].geminiKey = saved.gemini_key;
            if (saved.cover_letter) newResumes[index].coverLetter = saved.cover_letter;
          }
        });
        
        // Помечаем резюме с профилями браузера
        newResumes.forEach((resume, index) => {
          const slot = String(index + 1);
          if (browserProfiles[slot] && !resume.hhtoken) {
            resume.hasBrowserProfile = true;
          }
        });
        
        // Загружаем прогресс для всех резюме
        for (let i = 0; i < newResumes.length; i++) {
          const resumeId = String(i + 1);
          
          try {
            const progressResponse = await fetch(`/api/progress/${resumeId}`);
            if (progressResponse.ok) {
              const progress = await progressResponse.json();
              
              // Загружаем только если есть реальные данные
              if (progress.status && progress.status !== 'idle') {
                newResumes[i].status = progress.status;
                if (progress.parsed !== undefined) {
                  newResumes[i].progress = {
                    parsed: progress.parsed || 0,
                    target: progress.target || 4000,
                    applied: progress.applied || 0,
                  };
                }
                if (progress.topVacancies) {
                  newResumes[i].topVacancies = progress.topVacancies;
                }
              }
            }
          } catch (e) {
            console.error(`Failed to load progress for resume ${resumeId}:`, e);
          }
        }
        
        setResumes(newResumes);
      }
    } catch (error) {
      console.error('Failed to load resumes:', error);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    const savedUser = getUser();
    
    if (token && savedUser) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.ok) {
            setUser(savedUser);
            loadSavedResumes();
          } else {
            logout();
          }
        })
        .catch(() => logout())
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [loadSavedResumes]);

  const handleAuthSuccess = (user: User) => {
    setUser(user);
    loadSavedResumes();
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setResumes(createDefaultResumes());
  };

  const saveResume = useCallback(async (resume: Resume) => {
    try {
      const cookies = JSON.stringify({ hhtoken: resume.hhtoken, xsrf: resume.xsrf });
      await authFetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeSlot: parseInt(resume.id),
          cookies,
          hhUserName: resume.hhUserName || null,
          hhUserEmail: resume.hhUserEmail || null,
          geminiKey: resume.geminiKey,
          coverLetter: resume.coverLetter,
        }),
      });
    } catch (error) {
      console.error('Failed to save resume:', error);
    }
  }, []);

  const updateResume = useCallback((id: string, updates: Partial<Resume>) => {
    console.log(`[updateResume ${id}] Updates:`, JSON.stringify(updates));
    setResumes(prev => {
      const newResumes = prev.map(r => {
        if (r.id !== id) return r;
        
        // Мержим progress правильно
        const newProgress = updates.progress 
          ? { ...r.progress, ...updates.progress }
          : r.progress;
        
        return { 
          ...r, 
          ...updates, 
          progress: newProgress 
        };
      });
      
      const shouldSave = 'hhtoken' in updates || 'xsrf' in updates || 'hhUserName' in updates ||
        'hhUserEmail' in updates || 'geminiKey' in updates || 'coverLetter' in updates;
      
      const updatedResume = newResumes.find(r => r.id === id);
      if (updatedResume && shouldSave) saveResume(updatedResume);
      
      return newResumes;
    });
  }, [saveResume]);

  const addResume = () => {
    const maxId = Math.max(...resumes.map(r => parseInt(r.id) || 0), 0);
    const newSlot = maxId + 1;
    if (newSlot > 10) { alert('Максимум 10 резюме'); return; }
    setResumes([...resumes, createDefaultResume(newSlot)]);
  };

  const deleteResume = (id: string) => setResumes(resumes.filter(r => r.id !== id));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-16 h-16 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-xl">
          <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <AuthForm onSuccess={handleAuthSuccess} />;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-fuchsia-600 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600 rounded-full mix-blend-screen filter blur-[128px] opacity-10 animate-blob animation-delay-4000" />
      </div>

      <Header user={user} onLogout={handleLogout} />

      <main className="relative pt-28 pb-12 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-violet-200 to-fuchsia-200 bg-clip-text text-transparent mb-3">
              Управление резюме
            </h2>
            <p className="text-gray-500">Настройте параметры и запустите автоматические отклики</p>
          </div>

          {/* Resume cards */}
          <div className="space-y-6">
            {resumes.map(resume => (
              <ResumeCard key={resume.id} resume={resume} onUpdate={updateResume} onDelete={deleteResume} />
            ))}
          </div>

          {/* Add button */}
          <div className="mt-8 text-center">
            <button
              onClick={addResume}
              className="
                px-8 py-4
                bg-white/5 hover:bg-white/10
                backdrop-blur-xl
                border border-white/10 hover:border-white/20
                rounded-2xl
                text-gray-300 font-semibold
                shadow-lg hover:shadow-xl
                transform hover:scale-105 active:scale-95
                transition-all duration-300
              "
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Добавить резюме
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
