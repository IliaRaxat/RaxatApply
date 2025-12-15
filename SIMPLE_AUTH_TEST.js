// Упрощенный тест авторизации
const { spawn } = require('child_process');
const path = require('path');

console.log("🚀 Запуск теста авторизации...");

// Запускаем основную программу с тестовыми параметрами
const mainPath = path.join(__dirname, 'backend/src/main.js');
const child = spawn('node', [mainPath], {
  env: {
    ...process.env,
    TEST_MODE: 'true',
    VACANCY_COUNT: '30'
  },
  cwd: path.join(__dirname, 'backend')
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[STDOUT] ${output}`);
  
  // Если видим сообщение об авторизации, выводим дополнительную информацию
  if (output.includes('АВТОРИЗАЦИЯ')) {
    console.log("🔍 === ДЕТАЛИ АВТОРИЗАЦИИ ===");
  }
  
  if (output.includes('Токены авторизации')) {
    console.log("🔑 Проверка токенов...");
  }
  
  if (output.includes('РУЧНАЯ АВТОРИЗАЦИЯ')) {
    console.log("⚠️  НЕОБХОДИМА РУЧНАЯ АВТОРИЗАЦИЯ");
    console.log("👉 ВОЙДИТЕ В АККАУНТ В ОТКРЫВШЕМСЯ БРАУЗЕРЕ");
  }
});

child.stderr.on('data', (data) => {
  const output = data.toString();
  console.error(`[STDERR] ${output}`);
});

child.on('close', (code) => {
  console.log(`\n🏁 Процесс завершен с кодом ${code}`);
});

child.on('error', (error) => {
  console.error(`❌ Ошибка запуска процесса: ${error.message}`);
});