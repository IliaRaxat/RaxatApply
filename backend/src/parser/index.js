// parser/index.js

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

import { config } from "../config/index.js";
import {
  initializeDatabase,
  checkVacancyExists,
  addVacancy,
  updateVacancyRelevanceScore,
  dbAll,
} from "../db/database.js";
import { calculateVacancyRelevance, isVacancySuitable } from "../services/filter.js";
import { delay } from "../services/puppeteer.js";

// Функция для подсчета вакансий в БД
async function countVacancies() {
  try {
    const result = await dbAll(
      `SELECT COUNT(*) as count FROM vacancies WHERE (status IS NULL OR status = 'new')`,
      []
    );
    return result[0].count;
  } catch (error) {
    console.warn("⚠️ Ошибка подсчета вакансий:", error.message);
    return 0;
  }
}

/**
 * Парсер с ПЕРЕДАННЫМ браузером (сохраняет авторизацию)
 */
export async function parseHHVacanciesWithBrowser(browser, page) {
  try {
    console.log("🔧 НАЧАЛО ФУНКЦИИ ПАРСИНГА...");
    console.log("🔧 Browser:", !!browser);
    console.log("🔧 Page:", !!page);
    console.log("🔧 Resume ID:", process.env.RESUME_ID || 'default');
    
    if (!browser) {
      console.error("❌ Browser не передан в функцию парсинга!");
      return;
    }
    
    if (!page) {
      console.error("❌ Page не передан в функцию парсинга!");
      return;
    }
    
    console.log("🔧 Инициализация базы данных...");
    await initializeDatabase();
    console.log("✅ База данных инициализирована");
    
    // Получаем количество вакансий из переменной окружения или используем значение по умолчанию
    const TARGET_VACANCIES = parseInt(process.env.VACANCY_COUNT) || (process.env.TEST_MODE === 'true' ? 30 : 2000);
    console.log(`🔍 Начинаем парсинг вакансий с HH.ru...`);
    console.log(`🎯 ЦЕЛЬ: Собрать МИНИМУМ ${TARGET_VACANCIES} вакансий БЕЗ откликов ${process.env.TEST_MODE === 'true' ? '(ТЕСТОВЫЙ РЕЖИМ)' : '(ПРОДАКШН РЕЖИМ)'}`);
    
    // Отправляем информацию о целевом количестве для фронтенда СРАЗУ
    console.log(`TARGET_VACANCIES_JSON: ${JSON.stringify({ target: TARGET_VACANCIES })}`);
    console.log(`Прогресс: 0/${TARGET_VACANCIES}`);

    let currentCount = await countVacancies();
    console.log(`📊 В БД уже есть ${currentCount} вакансий`);
    
    // ВСЕГДА продолжаем парсинг, независимо от количества вакансий
    console.log("🚀 Начинаем сбор вакансий с HH.ru...");
    
    console.log("🔧 Начинаем цикл по поисковым запросам...");
    console.log("🔧 Количество запросов:", config.search.queries.length);

    // Повторяем проходы по запросам пока не наберём нужное количество
    let passNumber = 0;
    const MAX_PASSES = 5; // Максимум 5 проходов по всем запросам
    
    while (currentCount < TARGET_VACANCIES && passNumber < MAX_PASSES) {
      passNumber++;
      console.log(`\n🔄 ПРОХОД ${passNumber}/${MAX_PASSES} по поисковым запросам`);
      
    // Обрабатываем каждый поисковый запрос
    for (const queryObj of config.search.queries) {
      console.log("🔧 Обрабатываем поисковый запрос:", queryObj.value);
      currentCount = await countVacancies();
      
      // Отправляем прогресс ДО обработки каждого запроса
      console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
      
      // Проверяем достижение цели
      if (currentCount >= TARGET_VACANCIES) {
        console.log(`✅ ЦЕЛЬ ДОСТИГНУТА! Собрано ${currentCount} вакансий из ${TARGET_VACANCIES} необходимых`);
        // Отправляем финальный прогресс для фронтенда
        console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
        break;
      }
      
      let baseUrl;

      if (queryObj.type === 'text') {
        baseUrl = `https://hh.ru/search/vacancy?text=${encodeURIComponent(queryObj.value)}&items_on_page=100&order_by=publication_time`;
      } else if (queryObj.type === 'resume_based') {
        baseUrl = `https://hh.ru/search/vacancy?resume=${queryObj.resumeId}&items_on_page=100&order_by=publication_time`;
      } else {
        console.warn(`⚠️ Неизвестный тип запроса "${queryObj.type}". Пропускаем.`);
        continue;
      }

      console.log(`\n🌐 Обрабатываем запрос: "${queryObj.value || queryObj.resumeId}"`);
      console.log(`📊 Текущий прогресс: ${currentCount}/${TARGET_VACANCIES}`);

      // Увеличиваем количество страниц для большего охвата
      const MAX_PAGES = process.env.TEST_MODE === 'true' ? 10 : 50; // Увеличиваем для большего охвата
      let currentPage = 0;
      let hasMorePages = true;

      while (hasMorePages && currentPage < MAX_PAGES && currentCount < TARGET_VACANCIES) {
        const pageUrl = `${baseUrl}&page=${currentPage}`;
        const progressMsg = `🔄 Страница ${currentPage + 1} | Прогресс: ${currentCount}/${TARGET_VACANCIES}`;
        console.log(`\n${progressMsg}`);
        
        // Отправляем прогресс для фронтенда КАЖДУЮ страницу
        console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
        
        let retryCount = 0;
        const maxRetries = 3; // Уменьшаем количество попыток
        
        while (retryCount <= maxRetries) {
          try {
            console.log("🔧 Переход на страницу:", pageUrl);
            // Увеличиваем скорость загрузки страницы
            await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
            console.log("✅ Страница загружена");
            // Минимальная задержка после загрузки страницы
            await delay(300);
            
            console.log("🔧 Парсинг списка вакансий...");
            const vacancies = await parseVacanciesListPage(page);
            console.log("🔧 Найдено вакансий:", vacancies.length);
            
            if (vacancies.length === 0) {
              console.log(`ℹ️ Больше нет вакансий для этого запроса.`);
              hasMorePages = false;
            } else {
              console.log(`💾 Найдено ${vacancies.length} вакансий.`);
              await processAndSaveVacancies(vacancies);
              currentPage++;
              
              // Обновляем счетчик после добавления вакансий
              currentCount = await countVacancies();
              console.log(`📊 Обновленный счетчик: ${currentCount}`);
              if (currentCount >= TARGET_VACANCIES) {
                console.log(`\n🎉 ЦЕЛЬ ДОСТИГНУТА! Собрано ${currentCount} вакансий!`);
                hasMorePages = false;
                // Отправляем прогресс сразу
                console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
                break;
              }
              
              // Отправляем промежуточный прогресс
              console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
            }

            // Минимальная задержка между страницами
            await delay(500);
            break; // Успешно - выходим из retry цикла
            
          } catch (e) {
            retryCount++;
            console.warn(`⚠️ Ошибка при парсинге страницы ${currentPage + 1} (попытка ${retryCount}/${maxRetries + 1}): ${e.message}`);
            
            // Если это ошибка сети, пробуем подождать дольше
            if (e.message.includes('net::ERR_NAME_NOT_RESOLVED') || 
                e.message.includes('net::ERR_CONNECTION_RESET') || 
                e.message.includes('net::ERR_NETWORK_CHANGED') ||
                e.message.includes('Timeout') ||
                e.message.includes('net::ERR_CONNECTION_TIMED_OUT')) {
              console.log('📡 Сетевая ошибка, увеличиваем паузу...');
              await delay(2000); // Уменьшаем паузу при сетевых ошибках
            }
            
            if (retryCount > maxRetries) {
              // Исчерпали попытки - переходим к следующему запросу
              console.log(`❌ Пропускаем этот поисковый запрос после ${maxRetries + 1} неудачных попыток`);
              hasMorePages = false;
              break;
            }
            
            // Минимальная задержка перед повторной попыткой
            await delay(1000);
          }
        }
      }

      // Если мы дошли до конца страниц, прекращаем
      if (hasMorePages && currentPage >= MAX_PAGES) {
        console.log(`ℹ️ Достигнут лимит страниц (${MAX_PAGES}) для запроса "${queryObj.value || queryObj.resumeId}"`);
      }
      
      // Отправляем промежуточный прогресс после каждого запроса
      const finalCount = await countVacancies();
      console.log(`Прогресс: ${finalCount}/${TARGET_VACANCIES}`);
      
      // Проверяем достижение цели
      if (finalCount >= TARGET_VACANCIES) {
        console.log(`✅ ЦЕЛЬ ДОСТИГНУТА! Собрано ${finalCount} вакансий`);
        break;
      }
    }
    
    // Обновляем счётчик после прохода
    currentCount = await countVacancies();
    
    if (currentCount >= TARGET_VACANCIES) {
      console.log(`✅ ЦЕЛЬ ДОСТИГНУТА после прохода ${passNumber}!`);
      break;
    }
    
    console.log(`📊 После прохода ${passNumber}: ${currentCount}/${TARGET_VACANCIES}`);
    } // Конец while по проходам
    
    // Финальный подсчет
    const totalCount = await countVacancies();
    console.log(`\n📊 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ ПАРСИНГА:`);
    console.log(`   Собрано вакансий: ${totalCount}`);
    console.log(`   Целевое количество: ${TARGET_VACANCIES}`);
    console.log(`   Статус: ${totalCount >= TARGET_VACANCIES ? '✅ ДОСТИГНУТА' : '⚠️ НЕ ДОСТИГНУТА'}`);

    // Отправляем финальный прогресс для фронтенда
    console.log(`Прогресс: ${totalCount}/${TARGET_VACANCIES}`);

    // Добавляем специальную метку для завершения парсинга
    console.log("✅ ПАРСИНГ ЗАВЕРШЕН");
    
  } catch (error) {
    console.error("❌ ОШИБКА ПАРСИНГА:", error.message);
    console.error(error.stack);
  }
}

async function parseVacanciesListPage(page) {
  return await page.evaluate(() => {
    // Используем более надежные селекторы
    const vacancyElements = Array.from(
      document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]')
    );

    return vacancyElements
      .map((item) => {
        // Используем более надежные селекторы для элементов вакансии
        const titleElement = item.querySelector('[data-qa="serp-item__title"]') || 
                           item.querySelector('a[data-qa*="vacancy"]') ||
                           item.querySelector('a[href*="/vacancy/"]');
                           
        const companyElement = item.querySelector('[data-qa="vacancy-serp__vacancy-employer"]') || 
                             item.querySelector('[data-qa*="employer"]') ||
                             item.querySelector('.bloko-link_kind-tertiary');
                             
        const salaryElement = item.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]') || 
                            item.querySelector('[data-qa*="compensation"]') ||
                            item.querySelector('.bloko-header-section-3');

        let vacancyId = null;
        if (titleElement?.href) {
          const match = titleElement.href.match(/vacancy\/(\d+)/);
          vacancyId = match ? parseInt(match[1]) : null;
        }

        let statusOnListPage = null;
        const itemText = item.innerText || '';
        
        if (itemText.includes('Вы откликнулись') || 
            itemText.includes('Отклик отправлен') ||
            itemText.includes('Резюме отправлено') ||
            itemText.includes('Ваш отклик') ||
            itemText.includes('Не просмотрен') ||
            itemText.includes('Просмотрен')) {
          statusOnListPage = 'already_applied_hh';
        } else if (itemText.includes('Вас пригласили') || itemText.includes('Приглашение')) {
          statusOnListPage = 'invited_hh';
        } else if (itemText.includes('Вам отказали') || itemText.includes('Отказ')) {
          statusOnListPage = 'rejected_hh';
        }

        const link = titleElement?.href ? titleElement.href.split('?')[0] : null;
        
        return {
          vacancy_id: vacancyId,
          title: titleElement?.innerText?.trim() || "Без названия",
          company: companyElement?.innerText?.trim().replace(/\s+/g, ' ') || "Компания не указана",
          link: link,
          salary: salaryElement?.innerText?.replace(/\s/g, " ").trim() || null,
          status_on_list_page: statusOnListPage,
        };
      })
      .filter((v) => v.vacancy_id !== null && v.link !== null);
  });
}

async function processAndSaveVacancies(vacancies) {
  console.log("🔧 Обработка вакансий:", vacancies.length);
  let newAddedCount = 0;
  let skippedAlreadyApplied = 0;
  let skippedDuplicates = 0;
  let skippedFiltered = 0;
  
  // Последовательная обработка для стабильности
  for (const vacancy of vacancies) {
    try {
      if (!vacancy.link || !vacancy.vacancy_id) {
        console.log("⚠️ Пропущена вакансия без ссылки или ID");
        continue;
      }
      
      const exists = await checkVacancyExists(vacancy.vacancy_id);
      if (exists) {
        skippedDuplicates++;
        continue;
      }
      
      if (vacancy.status_on_list_page) {
        skippedAlreadyApplied++;
        continue;
      }
      
      // Сохраняем вакансию
      await addVacancy(vacancy);
      newAddedCount++;
      
      // Отправляем прогресс после каждой добавленной вакансии
      const TARGET_VACANCIES = parseInt(process.env.VACANCY_COUNT) || (process.env.TEST_MODE === 'true' ? 30 : 2000);
      const currentCount = await countVacancies();
      console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
      
    } catch (error) {
      console.warn(`⚠️ Ошибка при обработке вакансии ${vacancy.vacancy_id}: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Обработка завершена:`);
  console.log(`   Новых вакансий: ${newAddedCount}`);
  console.log(`   Пропущено (уже откликались): ${skippedAlreadyApplied}`);
  console.log(`   Пропущено (дубликаты): ${skippedDuplicates}`);
  console.log(`   Пропущено (фильтры): ${skippedFiltered}`);
}
