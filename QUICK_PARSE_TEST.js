// Быстрый тест парсинга
const { spawn } = require('child_process');
const path = require('path');

console.log("⚡ БЫСТРЫЙ ТЕСТ ПАРСИНГА");
console.log("======================");

// Запускаем парсинг с минимальными параметрами
const backendPath = path.join(__dirname, 'backend');
const mainScript = path.join(backendPath, 'src', 'main.js');

console.log("🚀 Запуск парсинга с 50 вакансиями...");

const child = spawn('node', [mainScript], {
  env: {
    ...process.env,
    RESUME_ID: '1',
    VACANCY_COUNT: '50',
    TEST_MODE: 'true'
  },
  cwd: backendPath
});

let progressUpdates = 0;

child.stdout.on('data', (data) => {
  const output = data.toString();
  
  // Показываем прогресс
  if (output.includes('Прогресс:')) {
    console.log(`📊 ${output.trim()}`);
    progressUpdates++;
  }
  
  // Показываем важные сообщения
  if (output.includes('ПАРСИНГ') || output.includes('Собрано') || output.includes('вакансий')) {
    console.log(`ℹ️  ${output.trim()}`);
  }
});

child.stderr.on('data', (data) => {
  const error = data.toString();
  console.error(`❌ ОШИБКА: ${error.trim()}`);
});

child.on('close', (code) => {
  console.log(`\n🏁 ПРОЦЕСС ЗАВЕРШЕН С КОДОМ ${code}`);
  console.log(`📈 Получено обновлений прогресса: ${progressUpdates}`);
  
  if (progressUpdates > 0) {
    console.log("✅ ПАРСИНГ РАБОТАЕТ! Прогресс отображается.");
  } else {
    console.log("❌ Проблема с отображением прогресса.");
  }
});