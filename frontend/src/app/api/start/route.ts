import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { progressStore, updateProgress } from '@/lib/progressStore';

const activeProcesses = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeId, hhtoken, xsrf, geminiKey } = body;

    if (!resumeId || !hhtoken || !xsrf || !geminiKey) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 });
    }

    // Путь к backend
    const mainPath = path.join(process.cwd(), '..', 'backend', 'src', 'main.js');

    const childProcess = spawn('node', [mainPath], {
      env: {
        ...process.env,
        RESUME_ID: resumeId,
        HH_TOKEN: hhtoken,
        XSRF: xsrf,
        GEMINI_KEY: geminiKey,
      },
      cwd: path.join(process.cwd(), '..', 'backend'),
    });

    activeProcesses.set(resumeId, childProcess);

    childProcess.stdout.on('data', data => {
      const output = data.toString();

      // Парсим прогресс
      const progressMatch = output.match(/Прогресс:\s*(\d+)\/(\d+)/);
      if (progressMatch) {
        updateProgress(resumeId, {
          parsed: parseInt(progressMatch[1]),
          target: parseInt(progressMatch[2]),
          status: 'parsing',
        });
      }

      // Определяем фазы
      if (output.includes('ФАЗА РЕЙТИНГА')) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'rating' });
      }

      // Парсим отклики
      const applyMatch = output.match(/Отклик\s*(\d+)\/(\d+)/);
      if (applyMatch) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, applied: parseInt(applyMatch[1]) });
      }

      // Парсим ВСЕ топ вакансии - построчно
      const lines = output.split('\n');
      const current = progressStore.get(resumeId) || {};
      const topVacancies = current.topVacancies || [];
      let vacanciesAdded = 0;
      
      for (const line of lines) {
        if (line.includes('TOP_VACANCY:')) {
          try {
            // Извлекаем JSON после TOP_VACANCY:
            const jsonStart = line.indexOf('{');
            const jsonEnd = line.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              const jsonStr = line.substring(jsonStart, jsonEnd + 1);
              const vacancy = JSON.parse(jsonStr);
              // Проверяем что такой вакансии еще нет
              if (!topVacancies.some((v: any) => v.vacancy_id === vacancy.vacancy_id)) {
                topVacancies.push(vacancy);
                vacanciesAdded++;
              }
            }
          } catch (e) {
            // Игнорируем ошибки парсинга отдельных строк
          }
        }
      }
      
      if (vacanciesAdded > 0) {
        updateProgress(resumeId, { ...current, topVacancies });
      }

      // Парсим статистику
      const statsMatch = output.match(/Статистика:\s*успешно=(\d+)\s*ошибок=(\d+)\s*всего=(\d+)\/(\d+)/);
      if (statsMatch) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, {
          ...current,
          applied: parseInt(statsMatch[3]),
          successCount: parseInt(statsMatch[1]),
          failedCount: parseInt(statsMatch[2]),
          totalCount: parseInt(statsMatch[4]),
          status: 'applying',
        });
      }
    });

    childProcess.stderr.on('data', data => {
      console.error(`[${resumeId}] ERROR: ${data.toString()}`);
    });

    childProcess.on('close', code => {
      console.log(`[${resumeId}] Процесс завершен с кодом ${code}`);
      activeProcesses.delete(resumeId);

      const current = progressStore.get(resumeId) || {};
      updateProgress(resumeId, {
        ...current,
        status: code === 0 ? 'completed' : 'error',
      });
    });

    return NextResponse.json({ success: true, message: 'Процесс запущен', resumeId });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Внутренняя ошибка' }, { status: 500 });
  }
}
