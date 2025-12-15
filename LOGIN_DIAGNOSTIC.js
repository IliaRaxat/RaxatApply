import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

async function loginDiagnostic() {
  console.log("🚀 Запуск диагностики входа в аккаунт HH.ru...");
  
  let browser;
  
  try {
    // Запуск браузера с расширенными настройками
    browser = await puppeteer.launch({
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
        '--ignore-ssl-errors',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Установка пользовательского агента
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Включение JavaScript после установки агента
    await page.setJavaScriptEnabled(true);
    
    console.log("🌐 Переход на hh.ru...");
    
    // Попытка перехода на сайт
    try {
      await page.goto('https://hh.ru', { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
      console.log("✅ Страница hh.ru загружена успешно");
    } catch (navError) {
      console.log("❌ Ошибка навигации:", navError.message);
      
      // Попытка альтернативного URL
      try {
        console.log("🔄 Пробуем альтернативный URL...");
        await page.goto('https://hh.ru/?', { 
          waitUntil: 'networkidle2', 
          timeout: 60000 
        });
        console.log("✅ Альтернативная страница загружена");
      } catch (altError) {
        console.log("❌ Альтернативная страница тоже не загружается:", altError.message);
        return;
      }
    }
    
    // Ждем немного для полной загрузки
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Проверяем текущий URL
    const currentUrl = page.url();
    console.log(`📍 Текущий URL: ${currentUrl}`);
    
    // Получаем заголовок страницы
    const title = await page.title();
    console.log(`📝 Заголовок страницы: ${title}`);
    
    // Проверяем наличие ключевых элементов
    const pageContent = await page.content();
    console.log(`📄 Размер контента: ${pageContent.length} символов`);
    
    // Ищем элементы авторизации
    const loginButton = await page.$('button[data-qa="login"]') || 
                       await page.$('a[data-qa="login"]') ||
                       await page.$('a[href*="login"]');
                       
    const accountSwitcher = await page.$('[data-qa="account-switcher"]');
    const userMenu = await page.$('[data-qa="user-menu"]');
    
    console.log(`🔓 Кнопка входа: ${!!loginButton}`);
    console.log(`👤 Аккаунт: ${!!accountSwitcher || !!userMenu}`);
    
    if (accountSwitcher || userMenu) {
      console.log("✅ Уже авторизованы!");
    } else if (loginButton) {
      console.log("⚠️ Нужно войти в аккаунт");
      console.log("👉 НАЖМИТЕ НА КНОПКУ ВХОДА И ВОЙДИТЕ В АККАУНТ");
      console.log("⏱️ У вас есть строго 5 минут (300 секунд) для входа...");
      
      // Ждем строго 5 минут (300 секунд) для ручного входа
      const totalSeconds = 300;
      for (let i = totalSeconds; i > 0; i -= 10) {
        console.log(`⏳ Осталось ${i} секунд из ${totalSeconds}...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      // Повторная проверка
      const accountSwitcher2 = await page.$('[data-qa="account-switcher"]');
      const userMenu2 = await page.$('[data-qa="user-menu"]');
      
      if (accountSwitcher2 || userMenu2) {
        console.log("✅ Авторизация выполнена!");
      } else {
        console.log("❌ Авторизация не выполнена");
      }
    } else {
      console.log("❓ Не удалось определить состояние авторизации");
    }
    
    console.log("\n⚠️ БРАУЗЕР ОСТАНЕТСЯ ОТКРЫТЫМ!");
    console.log("Закрой его вручную после проверки.");
    
  } catch (error) {
    console.error("❌ Ошибка диагностики:", error.message);
    console.error("STACK:", error.stack);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("❌ Ошибка закрытия браузера:", closeError.message);
      }
    }
  }
}

loginDiagnostic();