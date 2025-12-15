import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { progressStore, updateProgress } from '@/lib/progressStore';

const activeProcesses = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeId, hhtoken, xsrf, geminiKey, coverLetter, vacancyCount } = body;

    // Gemini ключ обязателен
    if (!resumeId || !geminiKey) {
      return NextResponse.json({ error: 'Resume ID и Gemini ключ обязательны' }, { status: 400 });
    }

    // Путь к backend с таймером авторизации
    const mainPath = path.join(process.cwd(), '..', 'backend', 'src', 'main.js');

    // Логируем параметры запуска
    console.log(`[API] Запуск процесса для резюме ${resumeId}`);
    console.log(`[API] Путь к main.js: ${mainPath}`);
    console.log(`[API] vacancyCount: ${vacancyCount}`);

    const childProcess = spawn('node', [mainPath], {
      env: {
        ...process.env,
        RESUME_ID: resumeId,
        // Токены могут быть пустыми - система авторизации будет ждать ручной авторизации
        HH_TOKEN: hhtoken || '',
        XSRF: xsrf || '',
        GEMINI_KEY: geminiKey,
        COVER_LETTER: coverLetter || '',
        VACANCY_COUNT: String(vacancyCount || 2000), // Передаём как строку с дефолтом
      },
      cwd: path.join(process.cwd(), '..', 'backend'),
    });

    activeProcesses.set(resumeId, childProcess);

    childProcess.stdout.on('data', data => {
      const output = data.toString();
      // Логируем весь вывод для отладки
      console.log(`[${resumeId}] STDOUT: ${output}`);

      // Парсим сообщения о прогрессе из парсинга (удаляем дублирующуюся проверку)
      const parsingProgressMatch = output.match(/Прогресс: (\d+)\/(\d+)/);
      if (parsingProgressMatch) {
        const parsed = parseInt(parsingProgressMatch[1]);
        const target = parseInt(parsingProgressMatch[2]);
        
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, {
          ...current,
          parsed: parsed,
          target: target,
          status: 'parsing'
        });
        
        console.log(`📊 Парсинг прогресс: ${parsed}/${target}`);
      }

      // Определяем фазы - более точная проверка
      if (output.includes('ФАЗА ПАРСИНГА') && output.includes('СЕЙЧАС СОБИРАЕМ ВАКАНСИИ')) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'parsing' });
      }
      
      if (output.includes('ФАЗА РЕЙТИНГА') && output.includes('СЕЙЧАС СОРТИРУЕМ ВАКАНСИИ')) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'rating' });
      }
      
      if (output.includes('ФАЗА ОТКЛИКА') && output.includes('СЕЙЧАС БУДУТ ОТПРАВЛЯТЬСЯ ОТКЛИКИ')) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'applying' });
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
        });
      }
      
      // Обработка сигналов авторизации
      if (output.includes('AUTHORIZATION_PERIOD_START: true')) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'waiting_for_auth' });
      }
      
      if (output.includes('AUTHORIZATION_PERIOD_END: true')) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'auth_completed' });
      }
      
      // Обработка завершения фаз
      if (output.includes('✅ Парсинг завершён') || output.includes('✅ ПАРСИНГ ЗАВЕРШЕН')) {
        // Не меняем статус здесь, чтобы не было скачков
      }
      
      // Обработка завершения всего процесса
      if (output.includes('CURRENT_PHASE: completed')) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'completed' });
      }
      
      if (output.includes('CURRENT_PHASE: error')) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'error' });
      }
      
      // Обработка TARGET_VACANCIES_JSON
      if (output.includes('TARGET_VACANCIES_JSON:')) {
        try {
          const jsonStart = output.indexOf('{');
          const jsonEnd = output.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const jsonStr = output.substring(jsonStart, jsonEnd + 1);
            const targetData = JSON.parse(jsonStr);
            const current = progressStore.get(resumeId) || {};
            updateProgress(resumeId, { ...current, target: targetData.target });
          }
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      }
    });

    childProcess.stderr.on('data', data => {
      const err = data.toString();
      console.error(`[${resumeId}] STDERR: ${err}`);
      // Также выводим в stdout для отладки
      console.log(`[${resumeId}] STDERR: ${err}`);
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