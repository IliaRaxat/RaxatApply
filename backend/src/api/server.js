// api/server.js - API сервер для связи фронтенда с основной программой

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Хранилище активных процессов
const activeProcesses = new Map();
const progressEmitter = new EventEmitter();

// Запуск процесса парсинга и откликов
app.post('/api/start', async (req, res) => {
  try {
    const { resumeId, hhtoken, xsrf, geminiKey, vacancyCount } = req.body;

    if (!resumeId || !hhtoken || !xsrf || !geminiKey) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const mainPath = path.join(__dirname, '../main.js');

    const childProcess = spawn('node', [mainPath], {
      env: {
        ...process.env,
        RESUME_ID: resumeId,
        HH_TOKEN: hhtoken,
        XSRF: xsrf,
        GEMINI_KEY: geminiKey,
        VACANCY_COUNT: vacancyCount || '' // Передаем количество вакансий
      },
      cwd: path.join(__dirname, '..')
    });

    activeProcesses.set(resumeId, childProcess);

    childProcess.stdout.on('data', (data) => {
      try {
        const output = data.toString();
        console.log(`[${resumeId}] ${output}`);

        // Используем значение в зависимости от переменной окружения или режима тестирования
        // Установим значение по умолчанию 2000 для production режима
        const targetVacancies = parseInt(process.env.VACANCY_COUNT) || (process.env.TEST_MODE === 'true' ? 30 : 2000);
        
        // Обрабатываем сигналы начала и конца периода авторизации
        if (output.includes('AUTHORIZATION_PERIOD_START: true')) {
          progressEmitter.emit('status', { resumeId, status: 'waiting_for_auth' });
          return;
        } else if (output.includes('AUTHORIZATION_PERIOD_END: true')) {
          // Не отправляем статус сразу, дадим системе время проверить авторизацию
          return;
        }
        
        const progressMatch = output.match(/Прогресс: (\d+)\/(\d+)/);
        if (progressMatch) {
          const [, current, total] = progressMatch;
          progressEmitter.emit('progress', {
            resumeId,
            type: 'parsing',
            current: parseInt(current),
            total: targetVacancies,
            target: targetVacancies
          });
        } else if (output.includes('TARGET_VACANCIES_JSON:')) {
          try {
            const jsonStr = output.replace('TARGET_VACANCIES_JSON: ', '');
            const targetData = JSON.parse(jsonStr);
            console.log(`🎯 Received target vacancies: ${JSON.stringify(targetData)}`);
            progressEmitter.emit('progress', { 
              resumeId, 
              target: targetData.target 
            });
          } catch (e) {
            console.error('❌ Error parsing target vacancies:', e.message);
          }
        }

        // Отправляем топ вакансий
        if (output.includes('TOP_VACANCY:')) {
          try {
            const jsonStr = output.replace('TOP_VACANCY: ', '');
            const vacancyData = JSON.parse(jsonStr);
            console.log(`📈 Received top vacancy: ${JSON.stringify(vacancyData)}`);
            
            // Увеличиваем количество передаваемых вакансий
            if (vacancyData.position <= 400) { // Было 100, теперь 400
              progressEmitter.emit('progress', { 
                resumeId, 
                topVacancies: [vacancyData] 
              });
            }
          } catch (e) {
            console.error('❌ Error parsing top vacancy:', e.message);
          }
        }

        if (output.includes('ФАЗА ПАРСИНГА')) {
          progressEmitter.emit('status', { resumeId, status: 'parsing' });
        } else if (output.includes('ФАЗА РЕЙТИНГА')) {
          progressEmitter.emit('status', { resumeId, status: 'rating' });
        } else if (output.includes('ФАЗА ОТКЛИКА')) {
          progressEmitter.emit('status', { resumeId, status: 'applying' });
        } else if (output.includes('ЗАВЕРШЕНО') || output.includes('CURRENT_PHASE: completed')) {
          progressEmitter.emit('status', { resumeId, status: 'completed' });
        } else if (output.includes('CURRENT_PHASE: error')) {
          progressEmitter.emit('status', { resumeId, status: 'error' });
        }
      } catch (e) {
        console.error('❌ Error processing stdout:', e.message);
      }
    });

    childProcess.stderr.on('data', (data) => {
      try {
        console.error(`[${resumeId}] ERROR: ${data}`);
      } catch (e) {
        console.error('❌ Error processing stderr:', e.message);
      }
    });

    childProcess.on('close', (code) => {
      try {
        console.log(`[${resumeId}] Процесс завершен с кодом ${code}`);
        activeProcesses.delete(resumeId);
        progressEmitter.emit('status', { 
          resumeId, 
          status: code === 0 ? 'completed' : 'error' 
        });
      } catch (e) {
        console.error('❌ Error processing close event:', e.message);
      }
    });

    childProcess.on('error', (error) => {
      try {
        console.error(`[${resumeId}] Process error:`, error);
        activeProcesses.delete(resumeId);
        progressEmitter.emit('status', { 
          resumeId, 
          status: 'error' 
        });
      } catch (e) {
        console.error('❌ Error processing error event:', e.message);
      }
    });

    res.json({ success: true, message: 'Процесс запущен', resumeId });
  } catch (error) {
    console.error('❌ API Start Error:', error.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// SSE endpoint для получения прогресса
app.get('/api/progress/:resumeId', (req, res) => {
  try {
    const { resumeId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Отключение буферизации Nginx

    // Heartbeat для поддержания соединения
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (e) {
        console.error('❌ Heartbeat error:', e.message);
        clearInterval(heartbeatInterval);
      }
    }, 25000); // Каждые 25 секунд

    const progressHandler = (data) => {
      try {
        if (data.resumeId === resumeId) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch (e) {
        console.error('❌ Error in progress handler:', e.message);
        clearInterval(heartbeatInterval);
      }
    };

    const statusHandler = (data) => {
      try {
        if (data.resumeId === resumeId) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch (e) {
        console.error('❌ Error in status handler:', e.message);
        clearInterval(heartbeatInterval);
      }
    };

    progressEmitter.on('progress', progressHandler);
    progressEmitter.on('status', statusHandler);

    req.on('close', () => {
      try {
        progressEmitter.off('progress', progressHandler);
        progressEmitter.off('status', statusHandler);
        clearInterval(heartbeatInterval);
      } catch (e) {
        console.error('❌ Error cleaning up handlers:', e.message);
      }
    });

    // Отправляем начальное сообщение
    res.write(`data: {"type": "connected", "resumeId": "${resumeId}"}\n\n`);
  } catch (error) {
    console.error('❌ Progress API Error:', error.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Остановка процесса
app.post('/api/stop/:resumeId', (req, res) => {
  try {
    const { resumeId } = req.params;
    const process = activeProcesses.get(resumeId);

    if (process) {
      process.kill();
      activeProcesses.delete(resumeId);
      res.json({ success: true, message: 'Процесс остановлен' });
    } else {
      res.status(404).json({ error: 'Процесс не найден' });
    }
  } catch (error) {
    console.error('❌ Stop API Error:', error.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  try {
    res.json({ status: 'ok', activeProcesses: activeProcesses.size });
  } catch (error) {
    console.error('❌ Health Check Error:', error.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API сервер запущен на http://localhost:${PORT}`);
});