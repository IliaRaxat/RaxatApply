// Простой тестовый скрипт для проверки парсинга
const { exec } = require('child_process');

console.log("🚀 Запуск простого теста парсинга...");

// Запускаем первый резюме с малым количеством вакансий для теста
const testCommand = 'set VACANCY_COUNT=50 && node backend/src/main.js';

exec(testCommand, (error, stdout, stderr) => {
  if (error) {
    console.error("❌ Ошибка выполнения:", error.message);
    return;
  }
  
  if (stderr) {
    console.error("⚠️ Предупреждения:", stderr);
  }
  
  console.log("✅ Результаты:");
  console.log(stdout);
});