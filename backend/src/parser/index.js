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

// Кэш ID вакансий в памяти для быстрой проверки дублей
const vacancyIdCache = new Set();
let cacheInitialized = false;

// Инициализация кэша из БД
async function initVacancyCache() {
  if (cacheInitialized) return;
  try {
    const existing = await dbAll(`SELECT vacancy_id FROM vacancies`, []);
    existing.forEach(v => vacancyIdCache.add(v.vacancy_id));
    cacheInitialized = true;
    console.log(`📦 Кэш инициализирован: ${vacancyIdCache.size} вакансий`);
  } catch (e) {
    console.warn("⚠️ Ошибка инициализации кэша:", e.message);
  }
}

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
    await initVacancyCache();
    console.log("✅ База данных и кэш инициализированы");
    
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
      currentCount = await countVacancies();
      console.log(`🔧 Запрос: ${queryObj.value} | ${currentCount}/${TARGET_VACANCIES}`);
      
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

      // HH показывает максимум 20 страниц по 100 вакансий = 2000 вакансий на запрос
      const MAX_PAGES = process.env.TEST_MODE === 'true' ? 10 : 20;
      let currentPage = 0;
      let emptyPagesInRow = 0; // Только пустые страницы прерывают
      let queryNewVacancies = 0; // Новых вакансий по этому запросу

      while (currentPage < MAX_PAGES && currentCount < TARGET_VACANCIES && emptyPagesInRow < 2) {
        const pageUrl = `${baseUrl}&page=${currentPage}`;
        
        try {
          await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
          
          const vacancies = await parseVacanciesListPage(page);
          
          if (vacancies.length === 0) {
            emptyPagesInRow++;
            console.log(`📄 Стр.${currentPage + 1} | Пустая страница (${emptyPagesInRow}/2)`);
          } else {
            emptyPagesInRow = 0;
            
            // Считаем сколько НОВЫХ вакансий на странице
            const newOnPage = vacancies.filter(v => 
              v.vacancy_id && !v.status_on_list_page && !vacancyIdCache.has(v.vacancy_id)
            ).length;
            
            await processAndSaveVacancies(vacancies);
            queryNewVacancies += newOnPage;
            currentCount = await countVacancies();
            
            console.log(`📄 Стр.${currentPage + 1} | +${newOnPage} новых | Всего: ${currentCount}/${TARGET_VACANCIES}`);
          }
          
          currentPage++;
          console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
          
          // Минимальная задержка (50мс) - защита от бана
          await delay(50);
          
        } catch (e) {
          console.warn(`⚠️ Ошибка стр.${currentPage}: ${e.message.slice(0, 50)}`);
          currentPage++;
          await delay(500);
        }
      }
      
      console.log(`📊 Запрос "${queryObj.value}" завершён: +${queryNewVacancies} новых вакансий за ${currentPage} страниц`);

      // Проверяем достижение цели
      const finalCount = await countVacancies();
      console.log(`Прогресс: ${finalCount}/${TARGET_VACANCIES}`);
      if (finalCount >= TARGET_VACANCIES) break;
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
  let added = 0;
  
  // Фильтруем сразу по кэшу - без запросов к БД
  const newVacancies = vacancies.filter(v => {
    if (!v.link || !v.vacancy_id) return false;
    if (v.status_on_list_page) return false;
    if (vacancyIdCache.has(v.vacancy_id)) return false;
    return true;
  });
  
  // Сохраняем только новые
  for (const vacancy of newVacancies) {
    try {
      await addVacancy(vacancy);
      vacancyIdCache.add(vacancy.vacancy_id); // Добавляем в кэш
      added++;
    } catch (e) {
      // Игнорируем ошибки (дубли и т.д.)
    }
  }
  
  if (added > 0) console.log(`💾 +${added} вакансий`);
}
