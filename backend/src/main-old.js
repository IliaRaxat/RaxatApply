#!/usr/bin/env node
// main.js - Главный файл приложения

import puppeteer from 'puppeteer';
import { config } from './config/index.js';
import { initializeDatabase, dbAll, dbRun, isVacancyBlacklisted } from './db/database.js';
import { parseHHVacanciesWithBrowser } from './parser/index.js';
import { applyToVacancySimple } from './applicator/simple.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для проверки авторизации
async function checkAuthorization(page) {
  console.log("🔍 Проверяем авторизацию...");
  
  // Проверяем, что страница активна
  try {
    const currentUrl = page.url();
    console.log(`📍 Текущий URL: ${currentUrl}`);
  } catch (urlError) {
    console.log(`❌ Ошибка получения URL: ${urlError.message}`);
    return false;
  }
  
  const result = await page.evaluate(() => {
    try {
      // Ищем элементы, которые есть только у залогиненного пользователя
      const accountSwitcher = document.querySelector('[data-qa="account-switcher"]');
      const userMenu = document.querySelector('[data-qa="user-menu"]');
      const profileLink = document.querySelector('a[href*="/applicant"]') || 
                         document.querySelector('a[href*="/resume"]');
      
      // Дополнительные селекторы для проверки авторизации
      const myResumes = document.querySelector('[data-qa="mainmenu_myResumes"]');
      const logoutLink = document.querySelector('a[href*="logout"]');
      const userName = document.querySelector('[data-qa="account-switcher-name"]');
      
      // Проверяем по тексту страницы
      const pageText = document.body.innerText || '';
      const hasAuthText = pageText.includes('Мои резюме') || 
                          pageText.includes('Выход') || 
                          pageText.includes('Профиль') ||
                          pageText.includes('Мои отклики');
      
      const isAuthorized = !!(accountSwitcher || userMenu || profileLink || myResumes || logoutLink || userName || hasAuthText);
      
      // Для отладки выводим информацию
      console.log(`   - Account Switcher: ${!!accountSwitcher}`);
      console.log(`   - User Menu: ${!!userMenu}`);
      console.log(`   - Profile Link: ${!!profileLink}`);
      console.log(`   - My Resumes: ${!!myResumes}`);
      console.log(`   - Logout Link: ${!!logoutLink}`);
      console.log(`   - User Name: ${!!userName}`);
      console.log(`   - Auth Text: ${hasAuthText}`);
      console.log(`   - Авторизован: ${isAuthorized}`);
      
      return isAuthorized;
    } catch (evalError) {
      console.log(`❌ Ошибка выполнения скрипта: ${evalError.message}`);
      return false;
    }
  });
  
  return result;
}

async function main() {
  console.log("=== HH.ru Auto Parser ===");
  console.log("🚀 Запуск...");
  console.log("");
  console.log("ℹ️ ПРОГРАММА РАБОТАЕТ В 3 ФАЗЫ:");
  console.log("  1. Парсинг - собираем вакансии (отклики НЕ отправляются)");
  console.log("  2. Рейтинг - сортируем вакансии (отклики НЕ отправляются)");
  console.log("  3. Отклик - отправляем отклики (только здесь отправляются отклики!)");
  console.log("");
  
  // Получаем количество вакансий из переменной окружения или используем значение по умолчанию
  // Установим значение по умолчанию 2000 для production режима
  const vacancyCount = parseInt(process.env.VACANCY_COUNT) || (process.env.TEST_MODE === 'true' ? 30 : 2000);
  console.log(process.env.TEST_MODE === 'true' ? "⚠️ ТЕСТОВЫЙ РЕЖИМ: Будет собрано только 30 вакансий" : `🚀 ПРОДАКШН РЕЖИМ: Будет собрано ${vacancyCount} вакансий`);
  console.log("");

  let browser = null;

  try {
    // 1. Инициализация БД
    await initializeDatabase();

    // 2. Очистка БД (кроме черного списка!)
    console.log("\n🗑️ Очистка базы данных...");
    await dbRun('DELETE FROM survey_answers');
    await dbRun('DELETE FROM vacancy_details');
    await dbRun('DELETE FROM vacancies');
    try { await dbRun('DELETE FROM sqlite_sequence'); } catch(e) {}
    
    // Показываем сколько вакансий в черном списке
    const blacklistCount = await dbAll('SELECT COUNT(*) as count FROM blacklisted_vacancies', []);
    console.log(`✅ База данных очищена (черный список: ${blacklistCount[0]?.count || 0} вакансий)`);

    // 3. Запуск браузера
    console.log("\n🌐 Открываем браузер...");
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

    // 4. Авторизация
    console.log("\n⏳ АВТОРИЗАЦИЯ");
    console.log("==================");
    
    // Переходим на главную страницу
    console.log("🏠 Переход на hh.ru...");
    let pageLoaded = false;
    
    try {
      await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log("✅ Переход выполнен");
      pageLoaded = true;
    } catch (navError) {
      console.log(`❌ Ошибка перехода: ${navError.message}`);
      console.log("🔄 Пробуем альтернативный URL...");
      try {
        await page.goto('https://hh.ru/?', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log("✅ Альтернативный переход выполнен");
        pageLoaded = true;
      } catch (altError) {
        console.log(`❌ Альтернативный переход тоже не удался: ${altError.message}`);
      }
    }
    
    // Если страница не загрузилась, ждем и пробуем снова
    if (!pageLoaded) {
      console.log("⏳ Страница не загрузилась, ждем 10 секунд и пробуем снова...");
      await sleep(10000);
      
      try {
        await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log("✅ Переход выполнен после ожидания");
        pageLoaded = true;
      } catch (retryError) {
        console.log(`❌ Повторный переход не удался: ${retryError.message}`);
      }
    }
    
    // Если все попытки неудачны, завершаем программу с ошибкой
    if (!pageLoaded) {
      console.log("❌ Не удалось загрузить страницу hh.ru");
      console.log("⚠️ Проверьте подключение к интернету и доступность сайта hh.ru");
      await browser.close();
      process.exit(1);
      return; // Добавляем return чтобы избежать дальнейшего выполнения
    }
    
    // Проверяем текущий URL
    const currentUrl = page.url();
    console.log(`📍 Текущий URL: ${currentUrl}`);
    
    // Проверяем, переданы ли токены через переменные окружения
    const hhToken = process.env.HH_TOKEN;
    const xsrf = process.env.XSRF;
    
    let authorized = false;
    
    // Если переданы токены, пробуем авторизоваться через них
    if (hhToken && xsrf && hhToken.trim() !== '' && xsrf.trim() !== '') {
      console.log("🔑 Обнаружены токены авторизации");
      console.log("   HH_TOKEN: " + (hhToken ? "[ПРИСУТСТВУЕТ]" : "[ОТСУТСТВУЕТ]"));
      console.log("   XSRF: " + (xsrf ? "[ПРИСУТСТВУЕТ]" : "[ОТСУТСТВУЕТ]"));
      
      // Устанавливаем куки
      await page.setCookie(
        { name: 'HHTOKEN', value: hhToken, domain: '.hh.ru', path: '/' },
        { name: 'XSRF-TOKEN', value: xsrf, domain: '.hh.ru', path: '/' }
      );
      console.log("🍪 Куки установлены");
      
      // Ждем немного, чтобы куки применились
      await sleep(3000);
      
      // Проверяем авторизацию
      console.log("🔍 Проверяем авторизацию через токены...");
      try {
        authorized = await checkAuthorization(page);
        console.log(`📊 Результат проверки авторизации: ${authorized ? 'УСПЕХ' : 'НЕУДАЧА'}`);
      } catch (authError) {
        console.log(`❌ Ошибка проверки авторизации: ${authError.message}`);
        authorized = false;
      }
      
      if (authorized) {
        console.log("✅ Авторизация через токены успешна!");
      } else {
        console.log("❌ Авторизация через токены не удалась");
      }
    } else {
      console.log("⚠️ Токены авторизации не переданы или пустые");
      console.log("   HH_TOKEN: " + (hhToken ? "[ПРИСУТСТВУЕТ]" : "[ОТСУТСТВУЕТ]"));
      console.log("   XSRF: " + (xsrf ? "[ПРИСУТСТВУЕТ]" : "[ОТСУТСТВУЕТ]"));
    }
    
    // Если авторизация через токены не удалась или токены не переданы
    if (!authorized) {
      console.log("\n⏳ НЕОБХОДИМА РУЧНАЯ АВТОРИЗАЦИЯ");
      console.log("=====================================");
      console.log("👉 ВОЙДИ В АККАУНТ HH.RU В ОТКРЫВШЕМСЯ БРАУЗЕРЕ");
      console.log("👉 Используй форму входа на сайте");
      console.log("👉 У тебя есть 300 секунд для авторизации...\n");
      
      // Проверяем, что браузер и страница активны
      try {
        const pages = await browser.pages();
        console.log(`📊 Активных страниц: ${pages.length}`);
        
        if (pages.length === 0) {
          console.log("❌ Нет активных страниц, создаем новую...");
          page = await browser.newPage();
          await page.setViewport({ width: 1920, height: 1080 });
        }
      } catch (browserError) {
        console.log(`❌ Ошибка проверки браузера: ${browserError.message}`);
      }
      
      // Показываем текущий URL и заголовок страницы для диагностики
      try {
        const currentUrl = page.url();
        const pageTitle = await page.title();
        console.log(`📍 Текущая страница: ${currentUrl}`);
        console.log(`📝 Заголовок: ${pageTitle}`);
      } catch (pageError) {
        console.log(`❌ Ошибка получения информации о странице: ${pageError.message}`);
      }
      
      // Ждём 300 секунд для ручной авторизации с пошаговым отображением
      console.log("⏳ НАЧИНАЕТСЯ ПЕРИОД АВТОРИЗАЦИИ НА 300 СЕКУНД...");
      console.log("AUTHORIZATION_PERIOD_START: true");
      for (let i = 300; i > 0; i -= 5) {
        console.log(`⏳ Осталось ${i} секунд...`);
        await sleep(5000);        
        // Проверяем, что страница еще активна
        try {
          const testUrl = page.url();
          console.log(`📍 Страница активна: ${testUrl.substring(0, 50)}...`);
        } catch (pageError) {
          console.log(`❌ Страница не активна: ${pageError.message}`);
          console.log("🔄 Пересоздаем страницу...");
          try {
            page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
            console.log("✅ Страница восстановлена");
          } catch (recreateError) {
            console.log(`❌ Не удалось восстановить страницу: ${recreateError.message}`);
          }
        }
        
        // Периодически проверяем авторизацию
        if (i % 15 === 0) { // Каждые 15 секунд
          console.log("🔍 Проверяем авторизацию...");
          try {
            authorized = await checkAuthorization(page);
            if (authorized) {
              console.log("✅ Авторизация выполнена!");
              break;
            }
          } catch (authError) {
            console.log(`❌ Ошибка проверки авторизации: ${authError.message}`);
          }
        }
      }
      
      console.log("⏳ ПЕРИОД АВТОРИЗАЦИИ ЗАВЕРШЕН. ПРОВЕРЯЕМ АВТОРИЗАЦИЮ...");
      console.log("AUTHORIZATION_PERIOD_END: true");
      
      // Финальная проверка авторизации
      if (!authorized) {
        console.log("🔍 Финальная проверка авторизации...");
        authorized = await checkAuthorization(page);
      }
    }    
    if (!authorized) {
      console.log("\n❌ ❌ ❌ АВТОРИЗАЦИЯ НЕ ВЫПОЛНЕНА! ❌ ❌ ❌");
      console.log("⚠️ Программа не может продолжить работу без авторизации");
      console.log("💡 Возможные причины:");
      console.log("   1. Неправильные токены авторизации");
      console.log("   2. Не выполнена ручная авторизация");
      console.log("   3. Проблемы с подключением к интернету");
      console.log("   4. Сайт hh.ru временно недоступен");
      console.log("   5. Изменения в структуре сайта HH.ru");
      console.log("");
      console.log("🔧 Рекомендации:");
      console.log("   1. Проверь правильность токенов");
      console.log("   2. Убедись, что ты вошел в аккаунт на сайте");
      console.log("   3. Попробуй запустить программу снова");
      console.log("   4. Используй скрипт LOGIN_DIAGNOSTIC.js для диагностики");
      
      // Дополнительная диагностика
      try {
        const finalUrl = page.url();
        const finalTitle = await page.title();
        console.log(`\n📍 Финальная страница: ${finalUrl}`);
        console.log(`📝 Заголовок: ${finalTitle}`);
      } catch (finalError) {
        console.log(`❌ Ошибка финальной диагностики: ${finalError.message}`);
      }
      
      await browser.close();
      console.log("\n🔚 Программа завершена");
      process.exit(1);
    }
    
    console.log("\n🎉 🎉 🎉 АВТОРИЗАЦИЯ УСПЕШНА! 🎉 🎉 🎉");
    console.log("🚀 Продолжаем работу...");
    
    // Добавляем паузу после авторизации чтобы убедиться что все готово
    console.log("⏳ Пауза после авторизации для подготовки к парсингу...");
    await sleep(5000); // Увеличиваем паузу до 5 секунд
    console.log("✅ Готовы к началу парсинга");    // 5. Парсинг вакансий
    console.log("\n======================================================");
    console.log("ФАЗА ПАРСИНГА");
    console.log("======================================================");
    console.log("ℹ️  СЕЙЧАС СОБИРАЕМ ВАКАНСИИ, ОТКЛИКИ ЕЩЁ НЕ ОТПРАВЛЯЮТСЯ!");
    
    // Отправляем информацию о текущей фазе для фронтенда
    console.log("CURRENT_PHASE: parsing");

    await parseHHVacanciesWithBrowser(browser, page);
    console.log("\n✅ Парсинг завершён");

    // 6. Получаем вакансии из БД
    console.log("\n======================================================");
    console.log("ФАЗА РЕЙТИНГА");
    console.log("======================================================");
    console.log("📊 СЕЙЧАС СОРТИРУЕМ ВАКАНСИИ ПО РЕЛЕВАНТНОСТИ, ОТКЛИКИ ЕЩЁ НЕ ОТПРАВЛЯЮТСЯ!");
    
    // Отправляем информацию о текущей фазе для фронтенда
    console.log("CURRENT_PHASE: rating");

    const allVacancies = await dbAll(
      `SELECT * FROM vacancies WHERE status IS NULL OR status = 'new' ORDER BY relevance_score DESC`,
      []
    );

    // Фильтруем вакансии из черного списка
    const vacancies = [];
    for (const v of allVacancies) {
      const blacklisted = await isVacancyBlacklisted(v.vacancy_id);
      if (!blacklisted) {
        vacancies.push(v);
      } else {
        console.log(`🚫 Пропуск (черный список): ${v.title}`);
      }
    }

    console.log(`\n📊 Найдено вакансий: ${vacancies.length} (из ${allVacancies.length}, ${allVacancies.length - vacancies.length} в черном списке)`);

    if (vacancies.length === 0) {
      console.log("❌ Нет вакансий для откликов!");
      await browser.close();
      return;
    }

    // Выводим топ вакансий для фронтенда (увеличиваем до 400)
    const TOP_VACANCIES_COUNT = 400;
    for (let i = 0; i < Math.min(vacancies.length, TOP_VACANCIES_COUNT); i++) {
      const v = vacancies[i];
      console.log(`${i + 1}. [${v.relevance_score}] ${v.title} | ${v.company}`);
      console.log(`TOP_VACANCY: ${JSON.stringify({
        position: i + 1,
        vacancy_id: v.vacancy_id,
        title: v.title,
        company: v.company,
        salary: v.salary,
        link: v.link,
        relevance_score: v.relevance_score || 0
      })}`);
    }
    
    // Отправляем информацию о целевом количестве вакансий
    const targetVacancies = parseInt(process.env.VACANCY_COUNT) || (process.env.TEST_MODE === 'true' ? 30 : 2000);
    console.log(`TARGET_VACANCIES: ${targetVacancies}`);

    // 7. Отправка откликов
    console.log("\n======================================================");
    console.log("ФАЗА ОТКЛИКА");
    console.log("======================================================");
    console.log("🚀 СЕЙЧАС БУДУТ ОТПРАВЛЯТЬСЯ ОТКЛИКИ НА ВАКАНСИИ!");
    
    // Отправляем информацию о текущей фазе для фронтенда
    console.log("CURRENT_PHASE: applying");

    let successCount = 0;
    let failedCount = 0;

    // Проверяем что страница ещё жива
    console.log(`\n🔍 Проверка страницы перед откликами...`);
    try {
      const testUrl = page.url();
      console.log(`✅ Страница активна: ${testUrl}`);
    } catch (e) {
      console.log(`❌ Страница не активна: ${e.message}`);
      console.log(`🔄 Создаём новую страницу...`);
      page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
    }

    // Используем страницу парсинга для откликов (уже авторизована)
    for (let i = 0; i < vacancies.length; i++) {
      const vacancy = vacancies[i];
      const num = i + 1;

      console.log(`\n📌 Отклик ${num}/${vacancies.length}: ${vacancy.title}`);
      console.log(`🔗 Ссылка: ${vacancy.link}`);

      try {
        const result = await applyToVacancySimple(vacancy, browser, page);

        if (result.success) {
          successCount++;
          console.log(`✅ УСПЕХ`);
        } else {
          failedCount++;
          console.log(`❌ НЕУДАЧА: ${result.reason}`);
        }
      } catch (err) {
        failedCount++;
        console.log(`❌ ИСКЛЮЧЕНИЕ: ${err.message}`);
        console.log(err.stack);
        
        // Если страница сломалась или сетевая ошибка - пересоздаём
        if (err.message.includes('Target') || 
            err.message.includes('context') ||
            err.message.includes('net::ERR_NAME_NOT_RESOLVED') || 
            err.message.includes('net::ERR_CONNECTION_RESET') || 
            err.message.includes('net::ERR_NETWORK_CHANGED') ||
            err.message.includes('Timeout') ||
            err.message.includes('net::ERR_CONNECTION_TIMED_OUT')) {
          console.log(`🔄 Пересоздаём страницу из-за ошибки...`);
          try {
            page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            // Переходим на hh.ru чтобы сохранить куки
            await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(1000);
          } catch (e2) {
            console.log(`❌ Не удалось пересоздать страницу: ${e2.message}`);
          }
        }
      }

      console.log(`📊 Статистика: успешно=${successCount} ошибок=${failedCount} всего=${num}/${vacancies.length}`);
      
      // Уменьшаем паузу между откликами для ускорения
      await sleep(500);
    }

    // 8. Итоги
    console.log("\n======================================================");
    console.log("ЗАВЕРШЕНО");
    console.log(`📊 Всего: ${vacancies.length} | Успешно: ${successCount} | Ошибок: ${failedCount}`);
    console.log("======================================================");
    
    // Отправляем информацию о завершении для фронтенда
    console.log("CURRENT_PHASE: completed");

  } catch (error) {
    console.error("\n❌ ОШИБКА:", error.message);
    console.error(error.stack);
    // Отправляем информацию об ошибке для фронтенда
    console.log("CURRENT_PHASE: error");
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("\n✅ Браузер закрыт");
      } catch (e) {}
    }
  }
}

main();