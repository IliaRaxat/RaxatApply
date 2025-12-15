// Тестовый скрипт для проверки только парсинга
const { spawn } = require('child_process');
const path = require('path');

console.log("🔍 Тест парсинга вакансий...");

// Запускаем только парсинг с небольшим количеством вакансий
const mainPath = path.join(__dirname, 'backend', 'src', 'main.js');

const childProcess = spawn('node', [mainPath], {
  env: {
    ...process.env,
    RESUME_ID: '1',
    VACANCY_COUNT: '50', // Малое количество для теста
    TEST_MODE: 'true'
  },
  cwd: path.join(__dirname, 'backend'),
});

childProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  
  // Проверяем ключевые сообщения
  if (output.includes('ПАРСИНГ ЗАВЕРШЕН') || output.includes('Парсинг завершён')) {
    console.log("✅ Парсинг завершен успешно!");
  }
  
  if (output.includes('Прогресс:')) {
    console.log("📊 Найдено сообщение о прогрессе");
  }
});

childProcess.stderr.on('data', (data) => {
  const err = data.toString();
  console.error('STDERR:', err);
});

childProcess.on('close', (code) => {
  console.log(`🏁 Процесс завершен с кодом ${code}`);
});