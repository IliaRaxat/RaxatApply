import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

async function authCheck() {
  console.log("🚀 Запуск проверки авторизации HH.ru...");
  
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
        '--ignore-ssl-errors'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Установка пользовательского агента
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log("🌐 Переход на hh.ru...");
    
    // Переход на сайт
    await page.goto('https://hh.ru', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    console.log("✅ Страница загружена");
    
    // Ждем немного для полной загрузки
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Расширенная проверка авторизации
    console.log("\n🔍 Расширенная проверка авторизации...");
    const authStatus = await page.evaluate(() => {
      // Все возможные селекторы для авторизованных пользователей
      const selectors = {
        accountSwitcher: document.querySelector('[data-qa="account-switcher"]'),
        userMenu: document.querySelector('[data-qa="user-menu"]'),
        profileLink: document.querySelector('a[href*="/applicant"]') || document.querySelector('a[href*="/resume"]'),
        myResumes: document.querySelector('[data-qa="mainmenu_myResumes"]'),
        logoutLink: document.querySelector('a[href*="logout"]'),
        userName: document.querySelector('[data-qa="account-switcher-name"]'),
        notificationBell: document.querySelector('[data-qa="notification-bell"]'),
        messages: document.querySelector('[data-qa="messages-counter"]')
      };
      
      // Проверка по тексту страницы
      const pageText = (document.body.innerText || '').toLowerCase();
      const hasAuthText = pageText.includes('мои резюме') || 
                         pageText.includes('выход') || 
                         pageText.includes('профиль') ||
                         pageText.includes('мои отклики') ||
                         pageText.includes('личный кабинет');
      
      // Считаем количество найденных элементов
      const foundElements = Object.values(selectors).filter(el => el !== null).length;
      const isAuthorized = foundElements > 0 || hasAuthText;
      
      return {
        isAuthorized,
        foundElements,
        hasAuthText,
        selectors: {
          accountSwitcher: !!selectors.accountSwitcher,
          userMenu: !!selectors.userMenu,
          profileLink: !!selectors.profileLink,
          myResumes: !!selectors.myResumes,
          logoutLink: !!selectors.logoutLink,
          userName: !!selectors.userName,
          notificationBell: !!selectors.notificationBell,
          messages: !!selectors.messages
        },
        pageTextSample: pageText.substring(0, 200) // Первые 200 символов для анализа
      };
    });
    
    console.log(`📊 Результаты проверки:`);
    console.log(`   Авторизован: ${authStatus.isAuthorized ? 'ДА' : 'НЕТ'}`);
    console.log(`   Найдено элементов: ${authStatus.foundElements}`);
    console.log(`   Текстовая проверка: ${authStatus.hasAuthText ? 'ДА' : 'НЕТ'}`);
    
    console.log(`\n📋 Детали по селекторам:`);
    for (const [key, value] of Object.entries(authStatus.selectors)) {
      console.log(`   - ${key}: ${value ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
    }
    
    if (!authStatus.isAuthorized) {
      console.log("\n⚠️ Нужно войти в аккаунт");
      console.log("👉 НАЖМИТЕ НА КНОПКУ ВХОДА И ВОЙДИТЕ В АККАУНТ");
      console.log("⏱️ У вас есть 5 минут для входа...");
      
      // Ждем 5 минут для ручного входа
      for (let i = 300; i > 0; i -= 10) {
        console.log(`⏳ Осталось ${i} секунд...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Периодическая проверка
        if (i % 30 === 0) {
          console.log("🔍 Повторная проверка авторизации...");
          const recheckStatus = await page.evaluate(() => {
            const selectors = {
              accountSwitcher: document.querySelector('[data-qa="account-switcher"]'),
              userMenu: document.querySelector('[data-qa="user-menu"]'),
              profileLink: document.querySelector('a[href*="/applicant"]') || document.querySelector('a[href*="/resume"]')
            };
            
            const pageText = (document.body.innerText || '').toLowerCase();
            const hasAuthText = pageText.includes('мои резюме') || pageText.includes('выход');
            
            return !!(selectors.accountSwitcher || selectors.userMenu || selectors.profileLink || hasAuthText);
          });
          
          if (recheckStatus) {
            console.log("✅ Авторизация выполнена!");
            break;
          }
        }
      }
    } else {
      console.log("\n🎉 Уже авторизованы!");
    }
    
    console.log("\n⚠️ БРАУЗЕР ОСТАНЕТСЯ ОТКРЫТЫМ!");
    console.log("Закрой его вручную после проверки.");
    
  } catch (error) {
    console.error("❌ Ошибка проверки авторизации:", error.message);
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

authCheck();