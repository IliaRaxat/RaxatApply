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
  const { resumeId, hhtoken, xsrf, geminiKey } = req.body;

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
      GEMINI_KEY: geminiKey
    },
    cwd: path.join(__dirname, '..')
  });

  activeProcesses.set(resumeId, childProcess);

  childProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[${resumeId}] ${output}`);

    const progressMatch = output.match(/Прогресс: (\d+)\/(\d+)/);
    if (progressMatch) {
      const [, current, total] = progressMatch;
      progressEmitter.emit('progress', {
        resumeId,
        type: 'parsing',
        current: parseInt(current),
        total: parseInt(total)
      });
    }

    if (output.includes('ФАЗА ПАРСИНГА')) {
      progressEmitter.emit('status', { resumeId, status: 'parsing' });
    } else if (output.includes('ФАЗА РЕЙТИНГА')) {
      progressEmitter.emit('status', { resumeId, status: 'rating' });
    } else if (output.includes('ФАЗА ОТКЛИКА')) {
      progressEmitter.emit('status', { resumeId, status: 'applying' });
    }
  });

  childProcess.stderr.on('data', (data) => {
    console.error(`[${resumeId}] ERROR: ${data}`);
  });

  childProcess.on('close', (code) => {
    console.log(`[${resumeId}] Процесс завершен с кодом ${code}`);
    activeProcesses.delete(resumeId);
    progressEmitter.emit('status', { 
      resumeId, 
      status: code === 0 ? 'completed' : 'error' 
    });
  });

  res.json({ success: true, message: 'Процесс запущен', resumeId });
});

// SSE endpoint для получения прогресса
app.get('/api/progress/:resumeId', (req, res) => {
  const { resumeId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const progressHandler = (data) => {
    if (data.resumeId === resumeId) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const statusHandler = (data) => {
    if (data.resumeId === resumeId) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  progressEmitter.on('progress', progressHandler);
  progressEmitter.on('status', statusHandler);

  req.on('close', () => {
    progressEmitter.off('progress', progressHandler);
    progressEmitter.off('status', statusHandler);
  });
});

// Остановка процесса
app.post('/api/stop/:resumeId', (req, res) => {
  const { resumeId } = req.params;
  const process = activeProcesses.get(resumeId);

  if (process) {
    process.kill();
    activeProcesses.delete(resumeId);
    res.json({ success: true, message: 'Процесс остановлен' });
  } else {
    res.status(404).json({ error: 'Процесс не найден' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeProcesses: activeProcesses.size });
});

app.listen(PORT, () => {
  console.log(`🚀 API сервер запущен на http://localhost:${PORT}`);
});
