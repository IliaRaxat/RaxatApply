import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { progressStore, updateProgress } from '@/shared/lib/progressStore';

export const dynamic = 'force-dynamic';

// Глобальный Map для отслеживания активных процессов
// Экспортируем через глобальный объект для доступа из других API routes
declare global {
  var activeProcesses: Map<string, any>;
}

if (!global.activeProcesses) {
  global.activeProcesses = new Map<string, any>();
}

const activeProcesses = global.activeProcesses;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeId, hhtoken, xsrf, geminiKey, coverLetter, vacancyCount } = body;

    if (!resumeId) {
      return NextResponse.json({ error: 'Resume ID обязателен' }, { status: 400 });
    }

    // Очищаем старый прогресс для этого резюме и устанавливаем начальный статус
    const { clearProgress } = await import('@/shared/lib/progressStore');
    clearProgress(resumeId);
    
    // Сразу устанавливаем начальный статус parsing
    updateProgress(resumeId, { 
      status: 'parsing', 
      parsed: 0, 
      target: vacancyCount || 2000 
    });

    // Путь к backend с таймером авторизации
    const mainPath = path.join(process.cwd(), '..', 'backend', 'src', 'main.js');

    // Логируем параметры запуска
    console.log(`[API] Запуск процесса для резюме ${resumeId}`);
    console.log(`[API] Путь к main.js: ${mainPath}`);
    console.log(`[API] vacancyCount: ${vacancyCount}`);
    console.log(`[API] hhtoken: ${hhtoken ? 'present (' + hhtoken.substring(0, 30) + '...)' : 'EMPTY'}`);
    console.log(`[API] xsrf: ${xsrf ? 'present' : 'EMPTY'}`);

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

      // Парсим сообщения о прогрессе из парсинга - несколько форматов
      const parsingProgressMatch = output.match(/Прогресс: (\d+)\/(\d+)/) || 
                                   output.match(/Всего: (\d+)\/(\d+)/);
      if (parsingProgressMatch) {
        const parsed = parseInt(parsingProgressMatch[1]);
        const target = parseInt(parsingProgressMatch[2]);
        
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, {
          ...current,
          parsed: parsed,
          target: target,
          status: current.status || 'parsing'
        });
        
        console.log(`📊 Парсинг прогресс: ${parsed}/${target}`);
      }

      // Определяем фазы - более точная проверка
      if (output.includes('CURRENT_PHASE: parsing') || 
          (output.includes('ФАЗА ПАРСИНГА') && output.includes('СЕЙЧАС СОБИРАЕМ ВАКАНСИИ'))) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'parsing' });
      }
      
      if (output.includes('CURRENT_PHASE: rating') ||
          (output.includes('ФАЗА РЕЙТИНГА') && output.includes('СЕЙЧАС СОРТИРУЕМ ВАКАНСИИ'))) {
        const current = progressStore.get(resumeId) || {};
        updateProgress(resumeId, { ...current, status: 'rating' });
      }
      
      if (output.includes('CURRENT_PHASE: applying') ||
          (output.includes('ФАЗА ОТКЛИКА') && output.includes('СЕЙЧАС БУДУТ ОТПРАВЛЯТЬСЯ ОТКЛИКИ'))) {
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
      
      // auth_completed только если ещё не начался парсинг/рейтинг/отклики
      if (output.includes('AUTHORIZATION_PERIOD_END: true')) {
        const current = progressStore.get(resumeId) || {};
        const activeStatuses = ['parsing', 'rating', 'applying', 'completed', 'error'];
        if (!activeStatuses.includes(current.status)) {
          updateProgress(resumeId, { ...current, status: 'auth_completed' });
        }
      }
      
      // Парсим извлечённые токены для сохранения
      if (output.includes('EXTRACTED_TOKENS:')) {
        try {
          // Находим начало JSON после EXTRACTED_TOKENS:
          const markerIndex = output.indexOf('EXTRACTED_TOKENS:');
          const jsonStart = output.indexOf('{', markerIndex);
          if (jsonStart !== -1) {
            // Ищем конец JSON - считаем скобки
            let depth = 0;
            let jsonEnd = -1;
            for (let i = jsonStart; i < output.length; i++) {
              if (output[i] === '{') depth++;
              if (output[i] === '}') depth--;
              if (depth === 0) {
                jsonEnd = i;
                break;
              }
            }
            
            if (jsonEnd !== -1) {
              const jsonStr = output.substring(jsonStart, jsonEnd + 1);
              console.log(`[${resumeId}] Parsing tokens JSON:`, jsonStr.substring(0, 100));
              const tokens = JSON.parse(jsonStr);
              const current = progressStore.get(resumeId) || {};
              
              // Сохраняем токены (используем allCookies если основные пустые)
              updateProgress(resumeId, { 
                ...current, 
                extractedTokens: {
                  hhtoken: tokens.HHTOKEN || tokens.allCookies || '',
                  xsrf: tokens.XSRF || '',
                  userName: tokens.userName || null,
                  userEmail: tokens.userEmail || null
                }
              });
              console.log(`[${resumeId}] Токены извлечены и сохранены в progress`);
            }
          }
        } catch (e) {
          console.error(`[${resumeId}] Ошибка парсинга токенов:`, e);
        }
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