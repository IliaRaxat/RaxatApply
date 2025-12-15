import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

async function testHHAccess() {
  console.log("🚀 Запуск теста доступа к hh.ru...");
  
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-features=BlockInsecurePrivateNetworkRequests',
      '--allow-running-insecure-content',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log("🌐 Переход на hh.ru...");
    await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log("✅ Переход выполнен успешно");
    
    // Ждем 10 секунд чтобы проверить
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log("🏁 Тест завершен");
  } catch (error) {
    console.error("❌ Ошибка:", error.message);
  } finally {
    await browser.close();
  }
}

testHHAccess();