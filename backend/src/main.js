#!/usr/bin/env node
// main-with-auth-timer.js - Главный файл приложения с таймером авторизации

import puppeteer from 'puppeteer';
import { config } from "./config/index.js";
import { initializeDatabase, dbAll, dbRun, isVacancyBlacklisted, updateVacancyRelevanceScore } from './db/database.js';
import { parseHHVacanciesWithBrowser } from './parser/index.js';
import { applyToVacancySimple } from './applicator/simple.js';

// Хранилище для таймеров авторизации
const authTimers = new Map();

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

// Функция для ожидания завершения таймера авторизации
async function waitForAuthTimer(resumeId) {
  console.log(`⏳ Ожидание завершения таймера авторизации для резюме ${resumeId}...`);
  
  // Отправляем сигнал о начале периода авторизации
  console.log("AUTHORIZATION_PERIOD_START: true");
  
  // Ждем 5 минут (300 секунд) с пошаговым отображением
  for (let i = 300; i > 0; i -= 5) {
    console.log(`⏳ Осталось ${i} секунд для авторизации...`);
    await sleep(5000);
  }
  
  // Отправляем сигнал о завершении периода авторизации
  console.log("AUTHORIZATION_PERIOD_END: true");
  console.log("✅ Период авторизации завершен. Начинаем парсинг...");
}

// Функция для автоматической авторизации по email/password
async function autoLogin(page, email, password) {
  try {
    console.log(`🔐 Автоматическая авторизация для ${email}...`);
    
    // Переходим на страницу входа
    await page.goto('https://hh.ru/account/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Ждем появления формы входа
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    
    // Заполняем форму
    await page.type('input[type="text"]', email, { delay: 100 });
    await page.type('input[type="password"]', password, { delay: 100 });
    
    // Нажимаем кнопку входа
    await page.click('button[data-qa="account-login-submit"]');
    
    // Ждем загрузки страницы после входа
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Проверяем успешность входа
    const isLoggedIn = await checkAuthorization(page);
    if (isLoggedIn) {
      console.log("✅ Автоматическая авторизация успешна!");
      return true;
    } else {
      console.log("❌ Автоматическая авторизация не удалась");
      return false;
    }
  } catch (error) {
    console.log(`❌ Ошибка автоматической авторизации: ${error.message}`);
    return false;
  }
}

// Функция для извлечения токенов из браузера после ручной авторизации
async function extractTokens(page) {
  try {
    console.log("🔍 Извлекаем токены из браузера...");
    
    // Получаем все куки
    const cookies = await page.cookies();
    
    // Ищем нужные токены
    const hhTokenCookie = cookies.find(cookie => cookie.name === 'HHTOKEN');
    const xsrfTokenCookie = cookies.find(cookie => cookie.name === 'XSRF-TOKEN');
    
    if (hhTokenCookie && xsrfTokenCookie) {
      const tokens = {
        HHTOKEN: hhTokenCookie.value,
        XSRF: xsrfTokenCookie.value
      };
      
      console.log("✅ Токены успешно извлечены:");
      console.log(`   HHTOKEN: ${tokens.HHTOKEN.substring(0, 20)}...`);
      console.log(`   XSRF: ${tokens.XSRF.substring(0, 20)}...`);
      
      return tokens;
    } else {
      console.log("⚠️ Не удалось найти нужные токены в куках");
      return null;
    }
  } catch (error) {
    console.log(`❌ Ошибка извлечения токенов: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log("=== HH.ru Auto Parser с таймером авторизации ===");
  console.log("🚀 Запуск...");
  console.log("");
  console.log("ℹ️ ПРОГРАММА РАБОТАЕТ В 3 ФАЗЫ:");
  console.log("  1. Ожидание авторизации (5 минут)");
  console.log("  2. Парсинг - собираем вакансии (отклики НЕ отправляются)");
  console.log("  3. Рейтинг - сортируем вакансии (отклики НЕ отправляются)");
  console.log("  4. Отклик - отправляем отклики (только здесь отправляются отклики!)");
  console.log("");
  
  // Получаем количество вакансий из переменной окружения или используем значение по умолчанию
  // Установим значение по умолчанию 2000 для production режима
  const vacancyCount = parseInt(process.env.VACANCY_COUNT) || (process.env.TEST_MODE === 'true' ? 30 : 2000);
  
  // Получаем ID резюме из переменной окружения
  const resumeId = process.env.RESUME_ID || '1';
  
  // Находим конфигурацию для текущего резюме
  const resumeConfig = config.resumes.find(r => r.id == resumeId) || config.resumes[0];
  console.log(`📋 Работаем с резюме: ${resumeConfig.name} (ID: ${resumeConfig.id})`);
  
  // Специальная проверка для первого резюме
  if (resumeId === '1') {
    console.log("🔧 Особая диагностика для первого резюме:");
    console.log(`   Email: ${resumeConfig.email || '[НЕ УКАЗАН]'}`);
    console.log(`   Password: ${resumeConfig.password ? '[УКАЗАН]' : '[НЕ УКАЗАН]'}`);
    console.log(`   HHTOKEN: "${resumeConfig.cookies.HHTOKEN}"`);
    console.log(`   XSRF: "${resumeConfig.cookies.XSRF}"`);
  }
  
  console.log(process.env.TEST_MODE === 'true' ? "⚠️ ТЕСТОВЫЙ РЕЖИМ: Будет собрано только 30 вакансий" : `🚀 ПРОДАКШН РЕЖИМ: Будет собрано ${vacancyCount} вакансий`);
  console.log("");

  let browser = null;
  let page = null;
  
  try {
    // 1. Инициализация БД
    console.log("\n📦 Инициализация базы данных для резюме:", process.env.RESUME_ID || 'default');
    await initializeDatabase();
    
    // ОЧИЩАЕМ базу данных перед каждым запуском чтобы начинать с нуля
    console.log("🗑️ Очистка базы данных...");
    await dbRun('DELETE FROM survey_answers');
    await dbRun('DELETE FROM vacancy_details');
    await dbRun('DELETE FROM vacancies');
    try { await dbRun('DELETE FROM sqlite_sequence WHERE name IN ("vacancies", "vacancy_details", "survey_answers")'); } catch(e) {}
    
    console.log("✅ База данных очищена и инициализирована");

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

    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 4. Ожидание авторизации с таймером
    console.log("\n⏳ ОЖИДАНИЕ АВТОРИЗАЦИИ");
    console.log("========================");
    
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
      
      // Для первого резюме принудительно игнорируем токены и требуем ручную авторизацию
      if (process.env.RESUME_ID === '1') {
        console.log("🔧 Первое резюме: принудительная ручная авторизация (токены игнорируются)");
        authorized = false;
      } else {
        // Для других резюме используем токены
        
        // Для первого резюме добавляем дополнительную проверку токенов
        if (process.env.RESUME_ID === '1') {
          console.log("🔧 Первое резюме: проверка действительности токенов...");
        }
        
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
          
          // Для первого резюме добавляем дополнительную диагностику
          if (process.env.RESUME_ID === '1' && !authorized) {
            console.log("🔧 Первое резюме: токены недействительны, требуется ручная авторизация");
          }
        } catch (authError) {
          console.log(`❌ Ошибка проверки авторизации: ${authError.message}`);
          authorized = false;
        }
        
        if (authorized) {
          console.log("✅ Авторизация через токены успешна!");
        } else {
          console.log("❌ Авторизация через токены не удалась");
        }
      }
    } else {
      console.log("⚠️ Токены авторизации не переданы или пустые");
      console.log("   HH_TOKEN: " + (hhToken ? "[ПРИСУТСТВУЕТ]" : "[ОТСУТСТВУЕТ]"));
      console.log("   XSRF: " + (xsrf ? "[ПРИСУТСТВУЕТ]" : "[ОТСУТСТВУЕТ]"));
      
      // Если токены не переданы, пробуем автоматическую авторизацию по email/password
      if (resumeConfig.email && resumeConfig.password) {
        console.log(`🤖 Пробуем автоматическую авторизацию для ${resumeConfig.email}...`);
        const autoLoginSuccess = await autoLogin(page, resumeConfig.email, resumeConfig.password);
        if (autoLoginSuccess) {
          authorized = true;
        }
      }
    }
    
    // Если авторизация через токены не удалась или токены не переданы
    if (!authorized) {
      console.log("\n⏳ НЕОБХОДИМА РУЧНАЯ АВТОРИЗАЦИЯ");
      console.log("=====================================");
      console.log("👉 ВОЙДИ В АККАУНТ HH.RU В ОТКРЫВШЕМСЯ БРАУЗЕРЕ");
      console.log("👉 Используй форму входа на сайте");
      console.log("👉 У тебя есть 300 секунд для авторизации...\n");
      
      // Ожидаем завершения таймера авторизации (5 минут)
      await waitForAuthTimer(resumeId);
      
      // После завершения таймера проверяем авторизацию
      console.log("🔍 Проверяем авторизацию после завершения таймера...");
      authorized = await checkAuthorization(page);
      
      // Если авторизация прошла успешно, извлекаем токены для будущего использования
      if (authorized) {
        const tokens = await extractTokens(page);
        if (tokens) {
          // Здесь можно сохранить токены для следующего запуска (опционально)
          console.log("🔒 Токены готовы к использованию при следующем запуске");
        }
      }
    }
    
    // Проверяем авторизацию после завершения таймера
    console.log("🔍 Проверяем авторизацию после завершения таймера...");
    authorized = await checkAuthorization(page);
    
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
    
    // 5. Парсинг вакансий
    console.log("\n======================================================");
    console.log("ФАЗА ПАРСИНГА");
    console.log("======================================================");
    console.log("ℹ️  СЕЙЧАС СОБИРАЕМ ВАКАНСИИ, ОТКЛИКИ ЕЩЁ НЕ ОТПРАВЛЯЮТСЯ!");

    // Отправляем информацию о текущей фазе для фронтенда
    console.log("CURRENT_PHASE: parsing");

    console.log("🔧 Вызываем функцию парсинга...");
    console.log("🔧 Browser перед вызовом:", !!browser);
    console.log("🔧 Page перед вызовом:", !!page);
    await parseHHVacanciesWithBrowser(browser, page);

    // Ждем немного, чтобы убедиться, что все сообщения обработаны
    await sleep(1000);

    console.log("\n✅ Парсинг завершён");

    // 6. Получаем вакансии из БД и вычисляем релевантность
    console.log("\n======================================================");
    console.log("ФАЗА РЕЙТИНГА");
    console.log("======================================================");
    console.log("📊 СЕЙЧАС ВЫЧИСЛЯЕМ РЕЛЕВАНТНОСТЬ И СОРТИРУЕМ ВАКАНСИИ!");

    // Отправляем информацию о текущей фазе для фронтенда
    console.log("CURRENT_PHASE: rating");

    // Импортируем функцию расчёта релевантности
    const { calculateVacancyRelevance, isVacancySuitable } = await import('./services/filter.js');

    const allVacancies = await dbAll(
      `SELECT * FROM vacancies WHERE status IS NULL OR status = 'new'`,
      []
    );

    console.log(`📊 Всего вакансий в БД: ${allVacancies.length}`);
    console.log("🔄 Вычисляем релевантность для каждой вакансии...");

    // Вычисляем релевантность для каждой вакансии
    const vacanciesWithScore = [];
    let blacklisted = 0;
    let zeroScore = 0;

    for (const v of allVacancies) {
      // Проверяем черный список
      const isBlacklisted = await isVacancyBlacklisted(v.vacancy_id);
      if (isBlacklisted) {
        blacklisted++;
        continue;
      }

      // Вычисляем релевантность (БЕЗ жёсткой фильтрации - только рейтинг)
      const score = calculateVacancyRelevance(v);
      
      // Обновляем score в БД
      await updateVacancyRelevanceScore(v.vacancy_id, score);
      
      // Добавляем ВСЕ вакансии, даже с нулевым score
      vacanciesWithScore.push({
        ...v,
        relevance_score: score
      });
      
      if (score === 0) zeroScore++;
    }

    // Сортируем по релевантности (от большего к меньшему)
    vacanciesWithScore.sort((a, b) => b.relevance_score - a.relevance_score);

    // Берём ВСЕ вакансии с score > 0, а если их мало - добавляем и с нулевым
    let vacancies = vacanciesWithScore.filter(v => v.relevance_score > 0);
    
    // Если релевантных вакансий меньше 100, добавляем и нерелевантные
    if (vacancies.length < 100) {
      console.log(`⚠️ Мало релевантных вакансий (${vacancies.length}), добавляем все`);
      vacancies = vacanciesWithScore;
    }

    console.log(`\n📊 Результат рейтинга:`);
    console.log(`   Всего в БД: ${allVacancies.length}`);
    console.log(`   В черном списке: ${blacklisted}`);
    console.log(`   С нулевым рейтингом: ${zeroScore}`);
    console.log(`   Релевантных (score > 0): ${vacanciesWithScore.length - zeroScore}`);
    console.log(`   Будет обработано: ${vacancies.length}`);

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
      
      // Специальная диагностика для первого резюме
      if (process.env.RESUME_ID === '1') {
        console.log(`🔧 Первое резюме: обработка вакансии ${vacancy.vacancy_id}`);
      }

      try {
        const result = await applyToVacancySimple(vacancy, browser, page);

        if (result.success) {
          successCount++;
          console.log(`✅ УСПЕХ`);
          
          // Специальная диагностика для первого резюме
          if (process.env.RESUME_ID === '1') {
            console.log(`🔧 Первое резюме: успешный отклик на вакансию ${vacancy.vacancy_id}`);
          }
        } else {
          failedCount++;
          console.log(`❌ НЕУДАЧА: ${result.reason}`);
          
          // Специальная диагностика для первого резюме
          if (process.env.RESUME_ID === '1') {
            console.log(`🔧 Первое резюме: неудачный отклик на вакансию ${vacancy.vacancy_id}, причина: ${result.reason}`);
          }
        }
      } catch (err) {
        failedCount++;
        console.log(`❌ ИСКЛЮЧЕНИЕ: ${err.message}`);
        console.log(err.stack);
        
        // Специальная диагностика для первого резюме
        if (process.env.RESUME_ID === '1') {
          console.log(`🔧 Первое резюме: исключение при отклике на вакансию ${vacancy.vacancy_id}`);
        }
        
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