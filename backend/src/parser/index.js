// parser/index.js - ПОЛНЫЙ ПАРСИНГ ВСЕХ СТРАНИЦ

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

import { config } from "../config/index.js";
import {
  initializeDatabase,
  addVacancy,
  dbAll,
  getAllAppliedVacancyIds,
} from "../db/database.js";
import { delay } from "../services/puppeteer.js";

// Кэш ID вакансий
const vacancyIdCache = new Set();
// Кэш ID вакансий на которые уже откликались с ЛЮБОГО резюме
let appliedFromOtherResumesCache = new Set();
let cacheInitialized = false;

async function initVacancyCache() {
  if (cacheInitialized) return;
  try {
    const existing = await dbAll(`SELECT vacancy_id FROM vacancies`, []);
    existing.forEach(v => vacancyIdCache.add(v.vacancy_id));
    
    // Загружаем ID вакансий на которые уже откликались с других резюме
    appliedFromOtherResumesCache = await getAllAppliedVacancyIds();
    
    cacheInitialized = true;
    console.log(`📦 Кэш: ${vacancyIdCache.size} вакансий в текущей БД`);
    console.log(`📦 Кэш: ${appliedFromOtherResumesCache.size} вакансий откликнуто с других резюме`);
  } catch (e) {
    console.error(`❌ Ошибка инициализации кэша: ${e.message}`);
  }
}

async function countVacancies() {
  try {
    const result = await dbAll(`SELECT COUNT(*) as count FROM vacancies WHERE (status IS NULL OR status = 'new')`, []);
    return result[0].count;
  } catch (e) {
    return 0;
  }
}

/**
 * Получает ID резюме пользователя с HH.ru для парсинга рекомендованных вакансий
 */
async function getResumeIdFromHH(page) {
  try {
    console.log("🔍 Получаем ID резюме с HH.ru...");
    
    // Переходим на страницу резюме
    await page.goto('https://hh.ru/applicant/resumes', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    await delay(1000);
    
    // Ищем ссылку на резюме и извлекаем ID
    const resumeId = await page.evaluate(() => {
      // Ищем ссылку на резюме
      const resumeLink = document.querySelector('a[data-qa="resume-title-link"]');
      if (resumeLink && resumeLink.href) {
        // Извлекаем ID из ссылки типа /resume/877fd373ff0f9dd0e00039ed1f333459353476
        const match = resumeLink.href.match(/\/resume\/([a-f0-9]+)/);
        if (match) return match[1];
      }
      
      // Альтернативный способ - ищем любую ссылку с resume
      const allLinks = document.querySelectorAll('a[href*="/resume/"]');
      for (const link of allLinks) {
        const match = link.href.match(/\/resume\/([a-f0-9]+)/);
        if (match) return match[1];
      }
      
      return null;
    });
    
    if (resumeId) {
      console.log(`✅ ID резюме найден: ${resumeId}`);
      return resumeId;
    } else {
      console.log("⚠️ ID резюме не найден");
      return null;
    }
  } catch (e) {
    console.log(`⚠️ Ошибка получения ID резюме: ${e.message}`);
    return null;
  }
}

/**
 * Парсит рекомендованные вакансии (подобранные под резюме)
 */
async function parseRecommendedVacancies(page, resumeId, vacancyIdCache, appliedFromOtherResumesCache) {
  if (!resumeId) {
    console.log("⚠️ Нет ID резюме - пропускаем рекомендованные вакансии");
    return 0;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`⭐ ПАРСИНГ РЕКОМЕНДОВАННЫХ ВАКАНСИЙ (подобранные под резюме)`);
  console.log(`${'='.repeat(60)}`);
  
  let totalNew = 0;
  let pageNum = 0;
  let hasMorePages = true;
  
  const baseUrl = `https://hh.ru/search/vacancy?resume=${resumeId}&hhtmFromLabel=rec_vacancy_show_all&hhtmFrom=main&items_on_page=100`;
  
  while (hasMorePages) {
    const pageUrl = `${baseUrl}&page=${pageNum}`;
    
    try {
      await page.goto(pageUrl, { 
        waitUntil: "domcontentloaded", 
        timeout: 20000 
      });
      
      // Парсим вакансии со страницы
      const vacancies = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]');
        return Array.from(items).map(item => {
          const titleEl = item.querySelector('[data-qa="serp-item__title"]');
          const companyEl = item.querySelector('[data-qa="vacancy-serp__vacancy-employer"]');
          const salaryEl = item.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]');
          
          let vacancyId = null;
          if (titleEl?.href) {
            const match = titleEl.href.match(/vacancy\/(\d+)/);
            vacancyId = match ? parseInt(match[1]) : null;
          }

          const text = item.innerText || '';
          let status = null;
          // Проверяем ТОЧНЫЕ фразы об уже отправленном отклике
          // НЕ используем просто "Отклик" - это слово есть в кнопке "Откликнуться"
          if (text.includes('Вы откликнулись') || 
              text.includes('Резюме отправлено') || 
              text.includes('Отклик отправлен') ||
              text.includes('Вы уже откликались')) {
            status = 'already_applied';
          }

          return {
            vacancy_id: vacancyId,
            title: titleEl?.innerText?.trim() || "Без названия",
            company: companyEl?.innerText?.trim() || "Не указана",
            link: titleEl?.href?.split('?')[0] || null,
            salary: salaryEl?.innerText?.trim() || null,
            status_on_list_page: status
          };
        }).filter(v => v.vacancy_id && v.link);
      });

      if (vacancies.length === 0) {
        console.log(`📄 Стр.${pageNum + 1} | ПУСТАЯ - рекомендации исчерпаны`);
        hasMorePages = false;
        break;
      }

      // Фильтруем новые вакансии
      const newVacancies = vacancies.filter(v => {
        if (v.status_on_list_page) return false;
        if (vacancyIdCache.has(v.vacancy_id)) return false;
        if (appliedFromOtherResumesCache.has(v.vacancy_id)) {
          console.log(`   ⏭️ Пропуск ${v.vacancy_id} - уже откликались с другого резюме`);
          return false;
        }
        return true;
      });

      // Сохраняем в БД
      for (const v of newVacancies) {
        try {
          await addVacancy(v);
          vacancyIdCache.add(v.vacancy_id);
        } catch (e) {}
      }

      totalNew += newVacancies.length;
      const currentCount = await countVacancies();
      
      console.log(`⭐ Стр.${pageNum + 1} | на странице: ${vacancies.length} | новых: +${newVacancies.length} | ВСЕГО: ${currentCount}`);

      pageNum++;
      await delay(50);
      
    } catch (e) {
      console.warn(`⚠️ Стр.${pageNum + 1} ошибка: ${e.message.slice(0, 50)}`);
      pageNum++;
      await delay(1000);
      
      if (pageNum > 20) {
        hasMorePages = false;
      }
    }
  }
  
  console.log(`\n⭐ ИТОГ рекомендованных: +${totalNew} вакансий за ${pageNum} страниц`);
  return totalNew;
}

/**
 * ПОЛНЫЙ ПАРСИНГ - ВСЕ страницы каждого запроса до конца
 */
export async function parseHHVacanciesWithBrowser(browser, page) {
  try {
    console.log("🚀 НАЧАЛО ПОЛНОГО ПАРСИНГА...");
    
    if (!browser || !page) {
      console.error("❌ Browser или Page не передан!");
      return;
    }
    
    await initializeDatabase();
    await initVacancyCache();
    
    const TARGET_VACANCIES = parseInt(process.env.VACANCY_COUNT) || 2000;
    console.log(`🎯 ЦЕЛЬ: ${TARGET_VACANCIES} вакансий`);
    console.log(`TARGET_VACANCIES_JSON: ${JSON.stringify({ target: TARGET_VACANCIES })}`);
    console.log(`Прогресс: 0/${TARGET_VACANCIES}`);

    let currentCount = await countVacancies();
    
    // ШАГ 1: Сначала парсим РЕКОМЕНДОВАННЫЕ вакансии (подобранные под резюме)
    const hhResumeId = await getResumeIdFromHH(page);
    if (hhResumeId) {
      await parseRecommendedVacancies(page, hhResumeId, vacancyIdCache, appliedFromOtherResumesCache);
      currentCount = await countVacancies();
      console.log(`\n📊 После рекомендаций: ${currentCount}/${TARGET_VACANCIES}`);
      console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
    }

    // ШАГ 2: Обрабатываем поисковые запросы
    for (const queryObj of config.search.queries) {
      // Проверяем цель только ПЕРЕД началом нового запроса
      if (currentCount >= TARGET_VACANCIES) {
        console.log(`\n✅ ЦЕЛЬ ДОСТИГНУТА: ${currentCount}/${TARGET_VACANCIES}`);
        break;
      }

      const searchText = queryObj.value;
      const experience = queryObj.experience || '';
      
      // Формируем URL с фильтром опыта если указан
      let baseUrl = `https://hh.ru/search/vacancy?text=${encodeURIComponent(searchText)}&items_on_page=100&order_by=publication_time`;
      if (experience) {
        baseUrl += `&experience=${experience}`;
      }
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🌐 ЗАПРОС: "${searchText}"${experience ? ` (опыт: ${experience})` : ''}`);
      console.log(`📊 Текущий прогресс: ${currentCount}/${TARGET_VACANCIES}`);
      console.log(`${'='.repeat(60)}`);

      let queryTotalNew = 0;
      let pageNum = 0;
      let hasMorePages = true;
      
      // Парсим ВСЕ страницы этого запроса пока они есть
      while (hasMorePages) {
        const pageUrl = `${baseUrl}&page=${pageNum}`;
        
        try {
          await page.goto(pageUrl, { 
            waitUntil: "domcontentloaded", 
            timeout: 20000 
          });
          
          // Парсим вакансии со страницы
          const vacancies = await page.evaluate(() => {
            const items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]');
            return Array.from(items).map(item => {
              const titleEl = item.querySelector('[data-qa="serp-item__title"]');
              const companyEl = item.querySelector('[data-qa="vacancy-serp__vacancy-employer"]');
              const salaryEl = item.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]');
              
              let vacancyId = null;
              if (titleEl?.href) {
                const match = titleEl.href.match(/vacancy\/(\d+)/);
                vacancyId = match ? parseInt(match[1]) : null;
              }

              const text = item.innerText || '';
              let status = null;
              // Проверяем ТОЧНЫЕ фразы об уже отправленном отклике
              // НЕ используем просто "Отклик" - это слово есть в кнопке "Откликнуться"
              if (text.includes('Вы откликнулись') || 
                  text.includes('Резюме отправлено') || 
                  text.includes('Отклик отправлен') ||
                  text.includes('Вы уже откликались')) {
                status = 'already_applied';
              }

              return {
                vacancy_id: vacancyId,
                title: titleEl?.innerText?.trim() || "Без названия",
                company: companyEl?.innerText?.trim() || "Не указана",
                link: titleEl?.href?.split('?')[0] || null,
                salary: salaryEl?.innerText?.trim() || null,
                status_on_list_page: status
              };
            }).filter(v => v.vacancy_id && v.link);
          });

          // Если страница пустая - запрос исчерпан
          if (vacancies.length === 0) {
            console.log(`📄 Стр.${pageNum + 1} | ПУСТАЯ - запрос "${searchText}" полностью обработан`);
            hasMorePages = false;
            break;
          }

          // Фильтруем новые вакансии (не дубли, не откликнутые, не откликнутые с других резюме)
          const newVacancies = vacancies.filter(v => {
            // Пропускаем если уже откликнулись (показано на странице)
            if (v.status_on_list_page) return false;
            // Пропускаем если уже есть в текущей БД
            if (vacancyIdCache.has(v.vacancy_id)) return false;
            // Пропускаем если уже откликались с ДРУГОГО резюме
            if (appliedFromOtherResumesCache.has(v.vacancy_id)) {
              console.log(`   ⏭️ Пропуск ${v.vacancy_id} - уже откликались с другого резюме`);
              return false;
            }
            return true;
          });

          // Сохраняем в БД
          for (const v of newVacancies) {
            try {
              await addVacancy(v);
              vacancyIdCache.add(v.vacancy_id);
            } catch (e) {}
          }

          queryTotalNew += newVacancies.length;
          currentCount = await countVacancies();
          
          console.log(`📄 Стр.${pageNum + 1} | на странице: ${vacancies.length} | новых: +${newVacancies.length} | ВСЕГО: ${currentCount}/${TARGET_VACANCIES}`);
          console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);

          pageNum++;
          
          // Минимальная пауза между страницами
          await delay(50);
          
        } catch (e) {
          console.warn(`⚠️ Стр.${pageNum + 1} ошибка: ${e.message.slice(0, 50)}`);
          // При ошибке пробуем следующую страницу
          pageNum++;
          await delay(1000);
          
          // Если много ошибок подряд - возможно запрос исчерпан
          if (pageNum > 25) {
            console.log(`⏹ Слишком много страниц (${pageNum}) - переходим к следующему запросу`);
            hasMorePages = false;
          }
        }
      }
      
      console.log(`\n📊 ИТОГ запроса "${searchText}": +${queryTotalNew} новых вакансий за ${pageNum} страниц`);
    }

    const totalCount = await countVacancies();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ ПАРСИНГ ПОЛНОСТЬЮ ЗАВЕРШЕН`);
    console.log(`📊 Всего собрано: ${totalCount} вакансий`);
    console.log(`🎯 Цель была: ${TARGET_VACANCIES}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Прогресс: ${totalCount}/${TARGET_VACANCIES}`);
    
  } catch (error) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА:", error.message);
  }
}

export { parseHHVacanciesWithBrowser as parseVacancies };
