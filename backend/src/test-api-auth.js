#!/usr/bin/env node
// test-api-auth.js - Тест авторизации через API

import { spawn } from 'child_process';
import path from 'path';

async function testApiAuth() {
  console.log("=== ТЕСТ АВТОРИЗАЦИИ ЧЕРЕЗ API ===");
  
  // Имитируем вызов API с токенами
  const mainPath = path.join(__dirname, 'main.js');
  
  const childProcess = spawn('node', [mainPath], {
    env: {
      ...process.env,
      HH_TOKEN: '', // Пустые токены для теста ручной авторизации
      XSRF: '',
      RESUME_ID: 'test-resume',
      GEMINI_KEY: 'test-key'
    },
    cwd: __dirname
  });

  childProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[STDOUT] ${output}`);
  });

  childProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(`[STDERR] ${output}`);
  });

  childProcess.on('close', (code) => {
    console.log(`\nПроцесс завершен с кодом ${code}`);
  });
}

testApiAuth();