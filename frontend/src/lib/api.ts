import { StartProcessParams } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export async function startProcess(params: StartProcessParams) {
  try {
    const response = await fetch(`${API_BASE}/api/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeId: params.resumeId,
        hhtoken: params.hhtoken,
        xsrf: params.xsrf,
        geminiKey: params.geminiKey,
        coverLetter: params.coverLetter,
        vacancyCount: params.vacancyCount,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка запуска процесса');
    }

    return response.json();
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Ошибка сети');
  }
}

// Новая функция для управления таймером авторизации
export async function controlAuthTimer(resumeId: string, action: 'start' | 'stop') {
  try {
    const response = await fetch(`${API_BASE}/api/auth-timer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeId,
        action
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка управления таймером авторизации');
    }

    return response.json();
  } catch (error: any) {
    console.error('Auth Timer API Error:', error);
    throw new Error(error.message || 'Ошибка сети');
  }
}

export async function stopProcess(resumeId: string) {
  try {
    const response = await fetch(`${API_BASE}/api/stop/${resumeId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка остановки процесса');
    }

    return response.json();
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Ошибка сети');
  }
}

export async function getVacancies(resumeId: string) {
  try {
    const response = await fetch(`${API_BASE}/api/vacancies/${resumeId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка получения вакансий');
    }

    return response.json();
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Ошибка сети');
  }
}