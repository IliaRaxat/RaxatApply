#!/usr/bin/env node
// main-with-auth-timer.js - Главный файл приложения с таймером авторизации

import puppeteer from 'puppeteer';
import { config } from "./config/index.js";
import { initializeDatabase, dbAll, dbRun, isVacancyBlacklisted, updateVacancyRelevanceScore, getAllAppliedVacancyIds } from './db/database.js';
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
      // Проверяем что НЕТ кнопки входа (главный признак неавторизованности)
      const loginButton = document.querySelector('[data-qa="login"]') || 
                          document.querySelector('[data-qa="account-login-button"]') ||
                          document.querySelector('button[data-qa="login"]') ||
                          document.querySelector('a[href*="/account/login"]');
      
      // Ищем элементы авторизованного пользователя
      const accountSwitcher = document.querySelector('[data-qa="account-switcher"]');
      const userName = document.querySelector('[data-qa="account-switcher-name"]');
      const userAvatar = document.querySelector('[data-qa="account-switcher-avatar"]');
      const myResumes = document.querySelector('[data-qa="mainmenu_myResumes"]');
      const applicantProfile = document.querySelector('[data-qa="mainmenu_applicantProfile"]');
      const responses = document.querySelector('[data-qa="mainmenu_responses"]');
      
      // Проверяем ссылки на профиль
      const profileLinks = document.querySelectorAll('a[href*="/applicant/"]');
      const hasProfileLink = profileLinks.length > 0;
      
      // Проверяем наличие аватара или иконки пользователя в хедере
      const headerUserIcon = document.querySelector('.supernova-navi-item_user') ||
                             document.querySelector('[data-qa="supernova-navi-item-user"]');
      
      // Считаем количество найденных элементов авторизации
      const authElementsCount = [accountSwitcher, userName, userAvatar, myResumes, 
                                 applicantProfile, responses, headerUserIcon, hasProfileLink].filter(Boolean).length;
      
      // НОВАЯ ЛОГИКА: Авторизован если есть хотя бы 1 элемент авторизации
      // (кнопка входа может быть на главной странице даже для авторизованных)
      const isAuthorized = authElementsCount >= 1;
      
      // Возвращаем детальную информацию для логирования
      return {
        isAuthorized,
        loginButton: !!loginButton,
        accountSwitcher: !!accountSwitcher,
        userName: !!userName,
        userAvatar: !!userAvatar,
        myResumes: !!myResumes,
        applicantProfile: !!applicantProfile,
        responses: !!responses,
        hasProfileLink,
        headerUserIcon: !!headerUserIcon,
        authElementsCount
      };
    } catch (evalError) {
      return {
        isAuthorized: false,
        error: evalError.message
      };
    }
  });
  
  // Логируем результаты проверки
  if (result.error) {
    console.log(`❌ Ошибка выполнения скрипта: ${result.error}`);
  } else {
    console.log(`   - Login Button: ${result.loginButton}`);
    console.log(`   - Account Switcher: ${result.accountSwitcher}`);
    console.log(`   - User Name: ${result.userName}`);
    console.log(`   - User Avatar: ${result.userAvatar}`);
    console.log(`   - My Resumes: ${result.myResumes}`);
    console.log(`   - Applicant Profile: ${result.applicantProfile}`);
    console.log(`   - Responses: ${result.responses}`);
    console.log(`   - Profile Links: ${result.hasProfileLink}`);
    console.log(`   - Header User Icon: ${result.headerUserIcon}`);
    console.log(`   - Auth Elements Count: ${result.authElementsCount}`);
    console.log(`   - Авторизован: ${result.isAuthorized}`);
  }
  
  return result.isAuthorized;
}

// Функция для ожидания авторизации (проверяет каждые 2 секунды)
async function waitForAuth(page) {
  console.log("AUTHORIZATION_PERIOD_START: true");
  console.log("⏳ Ожидание авторизации... Войдите в аккаунт HH.ru");
  
  const MAX_WAIT = 900; // Увеличиваем до 15 минут
  let waited = 0;
  
  while (waited < MAX_WAIT) {
    await sleep(3000); // Увеличиваем интервал проверки до 3 секунд
    waited += 3;
    
    try {
      const isAuth = await checkAuthorization(page);
      if (isAuth) {
        console.log("AUTHORIZATION_PERIOD_END: true");
        console.log("✅ Авторизация обнаружена! Начинаем работу...");
        return true;
      }
    } catch (e) {
      // Игнорируем ошибки проверки - страница может перезагружаться
    }
    
    if (waited % 10 === 0) {
      console.log(`⏳ Ожидание авторизации... (${waited} сек)`);
    }
  }
  
  console.log("AUTHORIZATION_PERIOD_END: true");
  console.log("❌ Время ожидания авторизации истекло");
  return false;
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

// Функция для извлечения токенов и данных пользователя из браузера после ручной авторизации
async function extractTokens(page) {
  try {
    console.log("🔍 Извлекаем токены из браузера...");
    
    // Получаем все куки
    const cookies = await page.cookies();
    
    // Логируем все куки для отладки
    console.log("🍪 Все куки:");
    cookies.forEach(c => {
      console.log(`   ${c.name}: ${c.value.substring(0, 30)}...`);
    });
    
    // Ищем нужные токены (проверяем разные варианты названий)
    const hhTokenCookie = cookies.find(cookie => 
      cookie.name === 'hhtoken' || 
      cookie.name === 'HHTOKEN' || 
      cookie.name === 'hh_token' ||
      cookie.name === '_xsrf'
    );
    const xsrfTokenCookie = cookies.find(cookie => 
      cookie.name === 'XSRF-TOKEN' || 
      cookie.name === 'xsrf' || 
      cookie.name === '_xsrf' ||
      cookie.name === 'csrftoken'
    );
    
    // Также ищем hhuid и другие важные куки
    const hhuidCookie = cookies.find(cookie => cookie.name === 'hhuid');
    const hhtokenCookie = cookies.find(cookie => cookie.name.toLowerCase().includes('token'));
    
    console.log(`🔍 Найденные токены:`);
    console.log(`   hhtoken: ${hhTokenCookie ? 'найден' : 'НЕ найден'}`);
    console.log(`   xsrf: ${xsrfTokenCookie ? 'найден' : 'НЕ найден'}`);
    console.log(`   hhuid: ${hhuidCookie ? 'найден' : 'НЕ найден'}`);
    
    // Собираем все куки в строку для сохранения
    const allCookiesStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const tokens = {
      HHTOKEN: hhTokenCookie?.value || hhuidCookie?.value || '',
      XSRF: xsrfTokenCookie?.value || '',
      allCookies: allCookiesStr,
      userName: null,
      userEmail: null
    };
    
    // Пробуем извлечь email/имя пользователя со страницы
    try {
      const userData = await page.evaluate(() => {
        // Ищем имя пользователя в разных местах
        const nameEl = document.querySelector('[data-qa="account-switcher-name"]') ||
                       document.querySelector('.supernova-navi-item_user-name') ||
                       document.querySelector('[data-qa="mainmenu_applicantProfile"]');
        
        // Ищем email в меню или профиле
        const emailEl = document.querySelector('[data-qa="account-switcher-email"]') ||
                        document.querySelector('.account-switcher-email');
        
        return {
          name: nameEl?.textContent?.trim() || null,
          email: emailEl?.textContent?.trim() || null
        };
      });
      
      tokens.userName = userData.name;
      tokens.userEmail = userData.email;
    } catch (e) {
      console.log("⚠️ Не удалось извлечь данные пользователя:", e.message);
    }
    
    console.log("✅ Токены извлечены:");
    console.log(`   HHTOKEN: ${tokens.HHTOKEN ? tokens.HHTOKEN.substring(0, 20) + '...' : 'пусто'}`);
    console.log(`   XSRF: ${tokens.XSRF ? tokens.XSRF.substring(0, 20) + '...' : 'пусто'}`);
    if (tokens.userName) console.log(`   Имя: ${tokens.userName}`);
    if (tokens.userEmail) console.log(`   Email: ${tokens.userEmail}`);
    
    return tokens;
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
  // Установим значение по умолчанию 4000 для production режима
  const vacancyCount = parseInt(process.env.VACANCY_COUNT) || (process.env.TEST_MODE === 'true' ? 30 : 4000);
  
  // Получаем ID резюме из переменной окружения
  const resumeId = process.env.RESUME_ID || '1';
  console.log(`📋 Работаем с резюме ID: ${resumeId}`);
  
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

    // 3. Запуск браузера с сохранением профиля для каждого резюме
    console.log("\n🌐 Открываем браузер...");
    
    // Создаём отдельную папку профиля для каждого резюме
    const resumeId = process.env.RESUME_ID || '1';
    const userDataDir = `./chrome-profiles/resume_${resumeId}`;
    console.log(`📁 Профиль браузера: ${userDataDir}`);
    
    // Пробуем запустить браузер, если профиль занят - ждём и пробуем снова
    let launchAttempts = 0;
    const maxAttempts = 3;
    
    while (launchAttempts < maxAttempts) {
      try {
        browser = await puppeteer.launch({
          headless: false,
          slowMo: 0,
          userDataDir: userDataDir,
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
        console.log("✅ Браузер запущен");
        break;
      } catch (launchError) {
        launchAttempts++;
        if (launchError.message.includes('already running')) {
          console.log(`⚠️ Профиль занят, попытка ${launchAttempts}/${maxAttempts}...`);
          // Ждём 3 секунды и пробуем снова
          await sleep(3000);
        } else {
          throw launchError;
        }
      }
    }
    
    if (!browser) {
      throw new Error('Не удалось запустить браузер - профиль занят другим процессом. Закройте все окна Chrome и попробуйте снова.');
    }

    // ВАЖНО: Используем существующие страницы из профиля вместо создания новой
    const pages = await browser.pages();
    if (pages.length > 0) {
      page = pages[0]; // Используем первую существующую страницу
      console.log("✅ Используем существующую страницу из профиля");
    } else {
      page = await browser.newPage(); // Создаем новую только если нет существующих
      console.log("✅ Создана новая страница");
    }
    await page.setViewport({ width: 1920, height: 1080 });

    // 4. Ожидание авторизации с таймером
    console.log("\n⏳ ОЖИДАНИЕ АВТОРИЗАЦИИ");
    console.log("========================");
    
    // Проверяем авторизацию в сохранённом профиле браузера
    let authorized = false;
    
    console.log("🔍 Проверяем авторизацию в сохранённом профиле...");
    
    // Сначала открываем главную страницу для проверки авторизации
    console.log("🏠 Открываем HH.ru для проверки...");
    try {
      await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log("✅ HH.ru открыт");
    } catch (navError) {
      console.log(`⚠️ Ошибка открытия HH.ru: ${navError.message}`);
    }
    
    await sleep(3000); // Даем странице загрузиться
    
    try {
      // СТРОГАЯ ПРОВЕРКА: проверяем и элементы И куки
      const hasAuthElements = await checkAuthorization(page);
      console.log(`📊 Элементы авторизации: ${hasAuthElements ? 'НАЙДЕНЫ' : 'НЕ НАЙДЕНЫ'}`);
      
      // ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА: проверяем что есть куки авторизации
      const cookies = await page.cookies();
      const authCookies = cookies.filter(c => 
        c.name === 'hhtoken' || 
        c.name === 'hhuid' || 
        c.name === '_xsrf' ||
        c.name === 'hhrole'
      );
      
      console.log(`📊 Найдено кук авторизации: ${authCookies.length}`);
      authCookies.forEach(c => {
        console.log(`   🍪 ${c.name}: ${c.value.substring(0, 20)}...`);
      });
      
      const hasAuthCookies = authCookies.length >= 1; // Достаточно хотя бы 1 куки
      
      // АВТОРИЗОВАН ТОЛЬКО ЕСЛИ ЕСТЬ И ЭЛЕМЕНТЫ И КУКИ
      authorized = hasAuthElements && hasAuthCookies;
      
      console.log(`📊 Результат проверки: ${authorized ? 'АВТОРИЗОВАН ✅' : 'НЕ АВТОРИЗОВАН ❌'}`);
      
      if (!hasAuthCookies) {
        console.log("⚠️ Недостаточно кук авторизации - требуется вход");
      }
      if (!hasAuthElements) {
        console.log("⚠️ Не найдены элементы авторизованного пользователя - требуется вход");
      }
    } catch (authError) {
      console.log(`❌ Ошибка проверки авторизации: ${authError.message}`);
      authorized = false;
    }
    
    if (authorized) {
      console.log("✅ Авторизация из сохранённого профиля успешна!");
      // Отправляем сигнал для фронтенда что авторизация пройдена
      console.log("AUTHORIZATION_PERIOD_END: true");
      
      // Извлекаем токены из сохранённого профиля и отправляем на фронтенд
      const tokens = await extractTokens(page);
      if (tokens) {
        console.log("🔒 Токены из профиля извлечены");
        console.log(`EXTRACTED_TOKENS: ${JSON.stringify(tokens)}`);
      }
    } else {
      console.log("⚠️ Требуется ручная авторизация");
      
      // Открываем страницу ЛОГИНА для ручной авторизации
      console.log("\n🔐 Открываем страницу входа...");
      try {
        await page.goto('https://hh.ru/account/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log("✅ Страница входа открыта");
      } catch (loginPageError) {
        console.log(`⚠️ Ошибка открытия страницы входа: ${loginPageError.message}`);
      }
      
      await sleep(2000);
      
      console.log("\n👉 ВОЙДИ В АККАУНТ HH.RU В ОТКРЫВШЕМСЯ БРАУЗЕРЕ");
      console.log("👉 Программа будет ждать 15 минут");
      console.log("👉 После входа парсинг начнется автоматически\n");
    }
    
    // Если авторизация через токены не удалась или токены не переданы
    if (!authorized) {
      console.log("\n⏳ НЕОБХОДИМА РУЧНАЯ АВТОРИЗАЦИЯ");
      console.log("=====================================");
      console.log("👉 ВОЙДИ В АККАУНТ HH.RU В ОТКРЫВШЕМСЯ БРАУЗЕРЕ");
      console.log("👉 Парсинг начнётся автоматически после входа\n");
      
      // Ожидаем авторизации (проверяем каждые 3 секунды)
      authorized = await waitForAuth(page);
      
      // Если авторизация прошла успешно, извлекаем токены и отправляем на фронтенд
      if (authorized) {
        const tokens = await extractTokens(page);
        if (tokens) {
          console.log("🔒 Токены сохранены");
          // Отправляем токены на фронтенд для сохранения (всегда, даже если частично пустые)
          console.log(`EXTRACTED_TOKENS: ${JSON.stringify(tokens)}`);
        }
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
    
    // 5. Парсинг вакансий
    console.log("\n======================================================");
    console.log("ФАЗА ПАРСИНГА");
    console.log("======================================================");
    console.log("ℹ️  СЕЙЧАС СОБИРАЕМ ВАКАНСИИ, ОТКЛИКИ ЕЩЁ НЕ ОТПРАВЛЯЮТСЯ!");

    // Отправляем информацию о текущей фазе для фронтенда
    console.log("CURRENT_PHASE: parsing");

    console.log("🔧 Вызываем функцию парсинга...");
    await parseHHVacanciesWithBrowser(browser, page);

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
    
    // Выводим примеры вакансий для диагностики
    console.log(`📊 Примеры вакансий в БД:`);
    for (let i = 0; i < Math.min(10, allVacancies.length); i++) {
      const v = allVacancies[i];
      console.log(`   ${i + 1}. ID:${v.vacancy_id} "${v.title}" | ${v.company}`);
    }
    
    // Загружаем ID вакансий на которые уже откликались с ДРУГИХ резюме
    const appliedFromOtherResumes = await getAllAppliedVacancyIds();
    console.log(`📊 Откликнуто с других резюме: ${appliedFromOtherResumes.size}`);
    
    // Показываем примеры откликнутых вакансий
    if (appliedFromOtherResumes.size > 0) {
      console.log(`📊 Примеры откликнутых с других резюме:`);
      let count = 0;
      for (const id of appliedFromOtherResumes) {
        if (count >= 10) break;
        console.log(`   - ID:${id}`);
        count++;
      }
    }
    
    console.log("🔄 Вычисляем релевантность для каждой вакансии...");

    // Вычисляем релевантность для каждой вакансии
    const vacanciesWithScore = [];
    let blacklisted = 0;
    let zeroScore = 0;
    let alreadyAppliedFromOther = 0;

    console.log(`🔄 Обрабатываем ${allVacancies.length} вакансий...`);

    for (const v of allVacancies) {
      // Проверяем черный список
      const isBlacklisted = await isVacancyBlacklisted(v.vacancy_id);
      if (isBlacklisted) {
        blacklisted++;
        console.log(`   🚫 Черный список: ${v.vacancy_id} "${v.title}"`);
        continue;
      }
      
      // Проверяем откликались ли с другого резюме
      if (appliedFromOtherResumes.has(v.vacancy_id)) {
        alreadyAppliedFromOther++;
        console.log(`   ⏭️ Пропуск ${v.vacancy_id} "${v.title}" - уже откликались с другого резюме`);
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
      
      if (score === 0) {
        zeroScore++;
        console.log(`   📊 Нулевой score: ${v.vacancy_id} "${v.title}"`);
      } else {
        console.log(`   📊 Score ${score}: ${v.vacancy_id} "${v.title}"`);
      }
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
    console.log(`   Уже откликнуто с других резюме: ${alreadyAppliedFromOther}`);
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
      
      // Отправляем статистику откликов на фронтенд
      console.log(`APPLY_STATS: ${JSON.stringify({ success: successCount, failed: failedCount, total: num, remaining: vacancies.length - num })}`);
      
      // Уменьшаем паузу между откликами для ускорения
      await sleep(200); // Уменьшаем с 500 до 200мс
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
    
    // Закрываем браузер при ошибке
    if (browser) {
      try {
        await browser.close();
        console.log("✅ Браузер закрыт после ошибки");
      } catch (e) {
        console.log(`⚠️ Ошибка при закрытии браузера: ${e.message}`);
      }
    }
    
    // ВАЖНО: Завершаем процесс с кодом ошибки
    process.exit(1);
  } finally {
    if (browser) {
      try {
        // ВАЖНО: Даем время на сохранение профиля перед закрытием
        console.log("\n⏳ Сохраняем профиль браузера...");
        await sleep(2000);
        await browser.close();
        console.log("✅ Браузер закрыт, профиль сохранен");
      } catch (e) {
        console.log(`⚠️ Ошибка при закрытии браузера: ${e.message}`);
      }
    }
  }
}

main();