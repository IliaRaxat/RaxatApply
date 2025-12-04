import { StartProcessParams } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export async function startProcess(params: StartProcessParams) {
  const response = await fetch(`${API_BASE}/api/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка запуска процесса');
  }

  return response.json();
}

export async function stopProcess(resumeId: string) {
  const response = await fetch(`${API_BASE}/api/stop/${resumeId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка остановки процесса');
  }

  return response.json();
}

export async function getVacancies(resumeId: string) {
  const response = await fetch(`${API_BASE}/api/vacancies/${resumeId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка получения вакансий');
  }

  return response.json();
}
