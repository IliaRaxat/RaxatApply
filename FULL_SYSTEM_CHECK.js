// Полная проверка системы
const fs = require('fs');
const path = require('path');

console.log("🚀 Начинаем полную проверку системы...");

// 1. Проверяем структуру проекта
console.log("\n📁 Проверка структуры проекта...");
const requiredDirs = [
  'backend/src',
  'frontend/src',
  'backend/src/parser',
  'backend/src/applicator',
  'backend/src/config',
  'backend/src/db',
  'backend/src/services'
];

const missingDirs = [];
for (const dir of requiredDirs) {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    missingDirs.push(dir);
  }
}

if (missingDirs.length > 0) {
  console.log("❌ Отсутствуют директории:", missingDirs);
} else {
  console.log("✅ Все необходимые директории присутствуют");
}

// 2. Проверяем ключевые файлы
console.log("\n📄 Проверка ключевых файлов...");
const requiredFiles = [
  'backend/src/main.js',
  'backend/src/parser/index.js',
  'backend/src/applicator/simple.js',
  'backend/src/config/index.js',
  'backend/src/db/database.js',
  'backend/src/services/filter.js',
  'backend/src/services/puppeteer.js',
  'frontend/src/app/api/start/route.ts',
  'frontend/src/components/ResumeCard.tsx'
];

const missingFiles = [];
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.log("❌ Отсутствуют файлы:", missingFiles);
} else {
  console.log("✅ Все ключевые файлы присутствуют");
}

// 3. Проверяем конфигурацию
console.log("\n⚙️ Проверка конфигурации...");
try {
  const configPath = path.join(__dirname, 'backend/src/config/index.js');
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  // Проверяем наличие 3 резюме
  const resumeMatches = configContent.match(/id:\s*\d+/g);
  if (resumeMatches && resumeMatches.length >= 3) {
    console.log("✅ Найдено 3 резюме в конфигурации");
  } else {
    console.log("⚠️ Недостаточно резюме в конфигурации");
  }
  
  // Проверяем поисковые запросы
  if (configContent.includes('search:') && configContent.includes('queries:')) {
    console.log("✅ Найдены поисковые запросы");
  } else {
    console.log("❌ Не найдены поисковые запросы");
  }
  
} catch (error) {
  console.log("❌ Ошибка проверки конфигурации:", error.message);
}

// 4. Проверяем базу данных
console.log("\n🗄️ Проверка базы данных...");
const dbPath = path.join(__dirname, 'backend/src/db/vacancies.db');
if (fs.existsSync(dbPath)) {
  console.log("✅ База данных существует");
} else {
  console.log("⚠️ База данных отсутствует (будет создана при первом запуске)");
}

// 5. Проверяем package.json
console.log("\n📦 Проверка package.json...");
try {
  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  if (packageJson.dependencies && packageJson.dependencies.puppeteer) {
    console.log("✅ Puppeteer установлен");
  } else {
    console.log("❌ Puppeteer не установлен");
  }
  
  if (packageJson.dependencies && packageJson.dependencies.next) {
    console.log("✅ Next.js установлен");
  } else {
    console.log("❌ Next.js не установлен");
  }
  
} catch (error) {
  console.log("❌ Ошибка проверки package.json:", error.message);
}

// 6. Проверяем скрипты запуска
console.log("\n🏃 Проверка скриптов запуска...");
const batFiles = [
  'RUN_FIRST_RESUME.bat',
  'RUN_ALL_RESUMES.bat',
  'QUICK_TEST_ALL.bat'
];

const missingBatFiles = [];
for (const file of batFiles) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    missingBatFiles.push(file);
  }
}

if (missingBatFiles.length > 0) {
  console.log("❌ Отсутствуют скрипты:", missingBatFiles);
} else {
  console.log("✅ Все скрипты запуска присутствуют");
}

console.log("\n✅ Проверка завершена!");