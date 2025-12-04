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
import { calculateVacancyRelevance } from "../services/filter.js";
import { delay } from "../services/puppeteer.js";

/**
 * Парсер с ПЕРЕДАННЫМ браузером (сохраняет авторизацию)
 */
export async function parseHHVacanciesWithBrowser(browser, page) {
  try {
    await initializeDatabase();
    
    const TARGET_VACANCIES = 1000;
    console.log(`🔍 Начинаем парсинг вакансий с HH.ru...`);
    console.log(`🎯 ЦЕЛЬ: Собрать МИНИМУМ ${TARGET_VACANCIES} вакансий БЕЗ откликов`);

    async function countVacancies() {
      const result = await dbAll(
        `SELECT COUNT(*) as count FROM vacancies WHERE (status IS NULL OR status = 'new')`,
        []
      );
      return result[0].count;
    }

    let currentCount = await countVacancies();
    console.log(`📊 В БД уже есть ${currentCount} вакансий`);

    outerLoop: for (const area of config.search.areas) {
      for (const queryObj of config.search.queries) {
        currentCount = await countVacancies();
        if (currentCount >= TARGET_VACANCIES) {
          console.log(`\n🎉 ЦЕЛЬ ДОСТИГНУТА! Собрано ${currentCount} вакансий!`);
          break outerLoop;
        }

        let baseUrl;
        let currentQueryDescription = '';

        if (queryObj.type === 'text') {
          baseUrl = `https://hh.ru/search/vacancy?text=${encodeURIComponent(queryObj.value)}&area=${area}&items_on_page=100&order_by=relevance`;
          currentQueryDescription = `текстовый запрос: "${queryObj.value}"`;
        } else if (queryObj.type === 'resume_based') {
          baseUrl = `https://hh.ru/search/vacancy?area=${area}&resume=${queryObj.resumeId}&items_on_page=100&order_by=relevance`;
          currentQueryDescription = `на основе резюме ID: "${queryObj.resumeId}"`;
        } else {
          console.warn(`⚠️ Неизвестный тип запроса "${queryObj.type}". Пропускаем.`);
          continue;
        }

        console.log(`\n🌐 Обрабатываем ${currentQueryDescription} в регионе ${area}.`);
        console.log(`📊 Текущий прогресс: ${currentCount}/${TARGET_VACANCIES} вакансий`);
        
        const MAX_PAGES = 40;
        let currentPage = 0;
        let hasMorePages = true;
        
        while (hasMorePages && currentPage < MAX_PAGES) {
          currentCount = await countVacancies();
          if (currentCount >= TARGET_VACANCIES) {
            console.log(`\n🎉 ЦЕЛЬ ДОСТИГНУТА! Собрано ${currentCount} вакансий!`);
            break outerLoop;
          }

          const pageUrl = `${baseUrl}&page=${currentPage}`;
          const progressMsg = `🔄 Страница ${currentPage + 1} | Прогресс: ${currentCount}/${TARGET_VACANCIES}`;
          console.log(`\n${progressMsg}`);
          
          if (process.stdout.isTTY === false) {
            process.stdout.write(`${progressMsg}\n`);
          }
          
          try {
            await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
            const vacancies = await parseVacanciesListPage(page);
            
            if (vacancies.length === 0) {
              console.log(`ℹ️ Больше нет вакансий для этого запроса.`);
              hasMorePages = false;
              break;
            }
            
            console.log(`💾 Найдено ${vacancies.length} вакансий на странице. Обрабатываем...`);
            await processAndSaveVacancies(vacancies);

            currentPage++;
          } catch (e) {
            console.warn(`⚠️ Ошибка при парсинге страницы ${currentPage + 1}: ${e.message}`);
            hasMorePages = false;
            break;
          }
        }
      }
    }
    
    const finalCount = await countVacancies();
    const totalVacancies = await dbAll(`SELECT COUNT(*) as count FROM vacancies`, []);
    const withResponse = await dbAll(
      `SELECT COUNT(*) as count FROM vacancies WHERE status IN ('already_applied_hh', 'invited_hh', 'rejected_hh')`,
      []
    );
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 ИТОГО: Собрано ${finalCount} вакансий БЕЗ откликов`);
    console.log(`📊 Всего в БД: ${totalVacancies[0].count} вакансий`);
    console.log(`⚠️ С откликами: ${withResponse[0].count} вакансий`);
    console.log(`${'='.repeat(60)}`);

  } catch (error) {
    console.error("❌ Ошибка при парсинге:", error.message);
  } finally {
    console.log("🏁 Парсинг завершен");
  }
}

async function parseVacanciesListPage(page) {
  return await page.evaluate(() => {
    const vacancyElements = Array.from(
      document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]')
    );

    return vacancyElements
      .map((item) => {
        const titleElement = item.querySelector('[data-qa="serp-item__title"]');
        const companyElement = item.querySelector('[data-qa="vacancy-serp__vacancy-employer"]');
        const salaryElement = item.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]') || item.querySelector('[class*="compensation"]');
        
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
  let newAddedCount = 0;
  let skippedAlreadyApplied = 0;
  let skippedDuplicates = 0;
  
  for (const vacancy of vacancies) {
    if (!vacancy.link || !vacancy.vacancy_id) continue;
    
    const exists = await checkVacancyExists(vacancy.vacancy_id);
    if (exists) {
      skippedDuplicates++;
      continue;
    }
    
    if (vacancy.status_on_list_page) {
      skippedAlreadyApplied++;
      continue;
    }
    
    newAddedCount++;
    await addVacancy(vacancy);
    
    const basicRelevance = calculateVacancyRelevance({ 
      title: vacancy.title, 
      company: vacancy.company,
      description_text: ''
    });
    await updateVacancyRelevanceScore(vacancy.vacancy_id, basicRelevance);
  }
  
  if (skippedAlreadyApplied > 0) {
    console.log(`📊 Добавлено ${newAddedCount} новых | ⚠️ Пропущено: ${skippedAlreadyApplied} откликнутых, ${skippedDuplicates} дубликатов`);
  } else {
    console.log(`📊 Добавлено ${newAddedCount} новых | Пропущено: ${skippedDuplicates} дубликатов`);
  }
}
