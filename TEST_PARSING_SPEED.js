// Тестовый скрипт для проверки скорости парсинга
import { parseHHVacanciesWithBrowser } from './backend/src/parser/index.js';
import { initializeBrowserAndPage } from './backend/src/services/puppeteer.js';
import { config } from './backend/src/config/index.js';

async function testParsingSpeed() {
  console.log("🚀 Запуск теста скорости парсинга...");
  
  try {
    // Инициализация браузера
    const cookies = [
      { name: 'HHTOKEN', value: '', domain: '.hh.ru', path: '/' },
      { name: 'XSRF', value: '', domain: '.hh.ru', path: '/' }
    ];
    
    const { browser, page } = await initializeBrowserAndPage(config, cookies);
    console.log("✅ Браузер инициализирован");
    
    // Запуск парсинга
    console.log("🔍 Начинаем парсинг...");
    const startTime = Date.now();
    
    await parseHHVacanciesWithBrowser(browser, page);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Парсинг завершен за ${duration} секунд`);
    
    // Закрываем браузер
    await browser.close();
    console.log("👋 Браузер закрыт");
    
  } catch (error) {
    console.error("❌ Ошибка теста:", error.message);
    console.error(error.stack);
  }
}

testParsingSpeed();