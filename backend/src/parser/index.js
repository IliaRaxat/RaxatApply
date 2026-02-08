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

// Кэш ID вакансий - ЛОКАЛЬНЫЙ для каждого запуска
// НЕ используем глобальные переменные чтобы избежать конфликтов между процессами
async function createFreshCache() {
  const vacancyIdCache = new Set();
  let appliedFromOtherResumesCache = new Set();
  
  try {
    const existing = await dbAll(`SELECT vacancy_id FROM vacancies`, []);
    existing.forEach(v => vacancyIdCache.add(v.vacancy_id));
    
    // Загружаем ID вакансий на которые уже откликались с других резюме
    appliedFromOtherResumesCache = await getAllAppliedVacancyIds();
    
    console.log(`📦 Кэш: ${vacancyIdCache.size} вакансий в текущей БД`);
    console.log(`📦 Кэш: ${appliedFromOtherResumesCache.size} вакансий откликнуто с других резюме`);
  } catch (e) {
    console.error(`❌ Ошибка инициализации кэша: ${e.message}`);
  }
  
  return { vacancyIdCache, appliedFromOtherResumesCache };
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
async function parseRecommendedVacancies(page, resumeId, vacancyIdCache, appliedFromOtherResumesCache, TARGET_VACANCIES) {
  if (!resumeId) {
    console.log("⚠️ Нет ID резюме - пропускаем рекомендованные вакансии");
    return 0;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`⭐ ПАРСИНГ РЕКОМЕНДОВАННЫХ ВАКАНСИЙ (подобранные под резюме)`);
  console.log(`⭐ Resume ID: ${resumeId}`);
  console.log(`⭐ Цель: ${TARGET_VACANCIES}`);
  console.log(`${'='.repeat(60)}`);
  
  let totalNew = 0;
  let pageNum = 0;
  let hasMorePages = true;
  let currentCount = 0;
  let emptyPagesInRow = 0; // Счётчик пустых страниц подряд
  
  // Убираем area=1 для поиска рекомендаций по всей России без фильтров
  const baseUrl = `https://hh.ru/search/vacancy?resume=${resumeId}&hhtmFromLabel=rec_vacancy_show_all&hhtmFrom=main&items_on_page=100`;
  console.log(`⭐ Base URL: ${baseUrl}`);
  
  while (hasMorePages && pageNum < 5) { // Ограничиваем 5 страницами для рекомендаций
    // ПРОВЕРЯЕМ ЦЕЛЬ ПЕРЕД КАЖДОЙ СТРАНИЦЕЙ
    currentCount = await countVacancies();
    console.log(`⭐ Проверка цели: ${currentCount}/${TARGET_VACANCIES}`);
    
    if (currentCount >= TARGET_VACANCIES) {
      console.log(`✅ ЦЕЛЬ ДОСТИГНУТА: ${currentCount}/${TARGET_VACANCIES} - останавливаем парсинг рекомендаций`);
      hasMorePages = false;
      break;
    }
    
    const pageUrl = `${baseUrl}&page=${pageNum}`;
    console.log(`⭐ Загружаем страницу ${pageNum + 1}: ${pageUrl}`);
    
    try {
      await page.goto(pageUrl, { 
        waitUntil: "domcontentloaded", 
        timeout: 20000 
      });
      
      // Минимальная задержка для загрузки
      await delay(100); // Уменьшаем с 300 до 100мс
      
      // Проверяем что страница загрузилась
      const pageTitle = await page.title();
      console.log(`⭐ Заголовок страницы: ${pageTitle}`);
      
      // Проверяем есть ли сообщение "По вашему запросу ничего не найдено"
      const noResultsMessage = await page.evaluate(() => {
        const noResults = document.querySelector('[data-qa="bloko-header-3"]') ||
                         document.querySelector('.bloko-header-3') ||
                         document.querySelector('[class*="nothing-found"]');
        return noResults ? noResults.textContent : null;
      });
      
      if (noResultsMessage && noResultsMessage.includes('ничего не найдено')) {
        console.log(`⭐ Рекомендации исчерпаны - нет результатов`);
        hasMorePages = false;
        break;
      }
      
      // Парсим вакансии со страницы
      const vacancies = await page.evaluate(() => {
        // Пробуем разные селекторы для максимального охвата
        let items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]');
        
        // Если не нашли, пробуем альтернативные селекторы
        if (items.length === 0) {
          items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy_standard"]');
        }
        if (items.length === 0) {
          items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy_premium"]');
        }
        if (items.length === 0) {
          items = document.querySelectorAll('.vacancy-serp-item');
        }
        if (items.length === 0) {
          items = document.querySelectorAll('[class*="vacancy-serp"]');
        }
        if (items.length === 0) {
          // Последняя попытка - ищем все карточки вакансий
          items = document.querySelectorAll('[data-qa*="vacancy"]');
        }
        if (items.length === 0) {
          // Еще один вариант - ищем по структуре
          items = document.querySelectorAll('div[data-qa*="serp"] > div');
        }
        if (items.length === 0) {
          // Ищем по классам
          items = document.querySelectorAll('.serp-item, .vacancy-item, [class*="vacancy"]');
        }
        
        console.log(`Найдено элементов вакансий: ${items.length}`);
        
        // Логируем HTML первого элемента для отладки
        if (items.length > 0) {
          console.log(`Первый элемент: ${items[0].outerHTML.substring(0, 500)}`);
        } else {
          // Если ничего не нашли, логируем структуру страницы
          console.log(`HTML страницы (первые 1000 символов): ${document.body.innerHTML.substring(0, 1000)}`);
        }
        
        return Array.from(items).map(item => {
          // Пробуем разные селекторы для заголовка
          let titleEl = item.querySelector('[data-qa="serp-item__title"]');
          if (!titleEl) titleEl = item.querySelector('[data-qa="bloko-header-2"]');
          if (!titleEl) titleEl = item.querySelector('a[href*="/vacancy/"]');
          if (!titleEl) titleEl = item.querySelector('h3 a');
          if (!titleEl) titleEl = item.querySelector('a');
          
          const companyEl = item.querySelector('[data-qa="vacancy-serp__vacancy-employer"]') ||
                           item.querySelector('[data-qa="vacancy-serp__vacancy-employer-link"]') ||
                           item.querySelector('[class*="employer"]');
          const salaryEl = item.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]') ||
                          item.querySelector('[class*="compensation"]') ||
                          item.querySelector('[class*="salary"]');
          
          let vacancyId = null;
          const href = titleEl?.href || item.querySelector('a[href*="/vacancy/"]')?.href;
          if (href) {
            const match = href.match(/vacancy\/(\d+)/);
            vacancyId = match ? parseInt(match[1]) : null;
          }

          const text = item.innerText || '';
          let status = null;
          if (text.includes('Вы откликнулись') || 
              text.includes('Резюме отправлено') || 
              text.includes('Отклик отправлен') ||
              text.includes('Вы уже откликались') ||
              text.includes('Вам отказали') ||
              text.includes('Вас пригласили') ||
              text.includes('Приглашение') ||
              text.includes('Отказ')) {
            status = 'already_applied';
          }

          return {
            vacancy_id: vacancyId,
            title: titleEl?.innerText?.trim() || "Без названия",
            company: companyEl?.innerText?.trim() || "Не указана",
            link: href?.split('?')[0] || null,
            salary: salaryEl?.innerText?.trim() || null,
            status_on_list_page: status
          };
        }).filter(v => v.vacancy_id && v.link);
      });

      console.log(`⭐ Найдено вакансий на странице: ${vacancies.length}`);

      if (vacancies.length === 0) {
        emptyPagesInRow++;
        console.log(`📄 Стр.${pageNum + 1} | ПУСТАЯ (${emptyPagesInRow} подряд)`);
        
        // Если 3 пустых страницы подряд - рекомендации исчерпаны
        if (emptyPagesInRow >= 3) {
          console.log(`⭐ ${emptyPagesInRow} пустых страниц подряд - рекомендации исчерпаны`);
          hasMorePages = false;
          break;
        }
        
        pageNum++;
        // Убираем задержку при ошибках для ускорения
        continue;
      }
      
      // Сбрасываем счётчик пустых страниц
      emptyPagesInRow = 0;

      // Фильтруем новые вакансии
      const newVacancies = vacancies.filter(v => {
        if (v.status_on_list_page) return false;
        if (vacancyIdCache.has(v.vacancy_id)) return false;
        if (appliedFromOtherResumesCache.has(v.vacancy_id)) return false;
        return true;
      });

      console.log(`⭐ Новых вакансий после фильтрации: ${newVacancies.length}`);

      // Сохраняем в БД
      for (const v of newVacancies) {
        try {
          await addVacancy(v);
          vacancyIdCache.add(v.vacancy_id);
        } catch (e) {
          // Игнорируем ошибки дубликатов
        }
      }

      totalNew += newVacancies.length;
      currentCount = await countVacancies();
      
      console.log(`⭐ Стр.${pageNum + 1} | на странице: ${vacancies.length} | новых: +${newVacancies.length} | ВСЕГО: ${currentCount}/${TARGET_VACANCIES}`);
      console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
      
      // Отправляем обновление прогресса для фронтенда
      console.log(`PARSING_PROGRESS: ${JSON.stringify({ parsed: currentCount, target: TARGET_VACANCIES })}`);

      pageNum++;
      // Убираем задержку полностью для максимальной скорости
      
    } catch (e) {
      console.warn(`⚠️ Стр.${pageNum + 1} ошибка: ${e.message}`);
      pageNum++;
      await delay(1000);
      
      if (pageNum > 20) {
        console.log(`⭐ Слишком много страниц (${pageNum}) - останавливаем`);
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
    const startTime = Date.now(); // Засекаем время начала
    
    if (!browser || !page) {
      console.error("❌ Browser или Page не передан!");
      return;
    }
    
    await initializeDatabase();
    
    // Создаём СВЕЖИЙ кэш для этого запуска
    const { vacancyIdCache, appliedFromOtherResumesCache } = await createFreshCache();
    
    const TARGET_VACANCIES = parseInt(process.env.VACANCY_COUNT) || 2000;
    console.log(`🎯 ЦЕЛЬ: ${TARGET_VACANCIES} вакансий`);
    console.log(`TARGET_VACANCIES_JSON: ${JSON.stringify({ target: TARGET_VACANCIES })}`);
    console.log(`Прогресс: 0/${TARGET_VACANCIES}`);
    
    // Отправляем начальный прогресс для фронтенда
    console.log(`PARSING_PROGRESS: ${JSON.stringify({ parsed: 0, target: TARGET_VACANCIES })}`);

    let currentCount = await countVacancies();
    
    // ШАГ 1: Сначала парсим РЕКОМЕНДОВАННЫЕ вакансии (подобранные под резюме)
    console.log(`🔍 Получаем ID резюме для рекомендаций...`);
    const hhResumeId = await getResumeIdFromHH(page);
    console.log(`📋 ID резюме: ${hhResumeId || 'НЕ НАЙДЕН'}`);
    
    if (hhResumeId && currentCount < TARGET_VACANCIES) {
      console.log(`🚀 Начинаем парсинг рекомендованных вакансий...`);
      await parseRecommendedVacancies(page, hhResumeId, vacancyIdCache, appliedFromOtherResumesCache, TARGET_VACANCIES);
      currentCount = await countVacancies();
      console.log(`\n📊 После рекомендаций: ${currentCount}/${TARGET_VACANCIES}`);
      console.log(`Прогресс: ${currentCount}/${TARGET_VACANCIES}`);
      
      // Проверяем достигнута ли цель
      if (currentCount >= TARGET_VACANCIES) {
        console.log(`✅ ЦЕЛЬ ДОСТИГНУТА после рекомендаций: ${currentCount}/${TARGET_VACANCIES}`);
        return;
      }
    } else {
      console.log(`⚠️ Пропускаем рекомендации: hhResumeId=${hhResumeId}, currentCount=${currentCount}, TARGET=${TARGET_VACANCIES}`);
    }

    // ШАГ 2: Обрабатываем поисковые запросы
    for (const queryObj of config.search.queries) {
      // Проверяем цель только ПЕРЕД началом нового запроса
      currentCount = await countVacancies();
      if (currentCount >= TARGET_VACANCIES) {
        console.log(`\n✅ ЦЕЛЬ ДОСТИГНУТА: ${currentCount}/${TARGET_VACANCIES}`);
        break;
      }
      
      // Если уже набрали 80% от цели, останавливаемся чтобы не тратить время
      if (currentCount >= TARGET_VACANCIES * 0.8) {
        console.log(`\n✅ НАБРАНО 80% ОТ ЦЕЛИ: ${currentCount}/${TARGET_VACANCIES} - останавливаем парсинг`);
        break;
      }

      const searchText = queryObj.value;
      const experience = queryObj.experience || '';
      
      // Формируем URL с фильтром опыта если указан
      // Убираем area=1 (только Москва) для поиска по всей России без дополнительных фильтров
      let baseUrl = `https://hh.ru/search/vacancy?text=${encodeURIComponent(searchText)}&items_on_page=100&order_by=publication_time`;
      if (experience) {
        baseUrl += `&experience=${experience}`;
      }
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🌐 ЗАПРОС: "${searchText}"${experience ? ` (опыт: ${experience})` : ''}`);
      console.log(`🌐 URL: ${baseUrl}`);
      console.log(`📊 Текущий прогресс: ${currentCount}/${TARGET_VACANCIES}`);
      console.log(`${'='.repeat(60)}`);

      let queryTotalNew = 0;
      let pageNum = 0;
      let hasMorePages = true;
      
      // Парсим ВСЕ страницы этого запроса пока они есть (максимум 10 страниц на запрос)
      while (hasMorePages && pageNum < 10) { // Ограничиваем 10 страницами на запрос
        // ПРОВЕРЯЕМ ЦЕЛЬ ПЕРЕД КАЖДОЙ СТРАНИЦЕЙ
        currentCount = await countVacancies();
        if (currentCount >= TARGET_VACANCIES) {
          console.log(`✅ ЦЕЛЬ ДОСТИГНУТА: ${currentCount}/${TARGET_VACANCIES} - останавливаем парсинг`);
          hasMorePages = false;
          break;
        }
        
        const pageUrl = `${baseUrl}&page=${pageNum}`;
        
        try {
          console.log(`🌐 Загружаем страницу: ${pageUrl}`);
          await page.goto(pageUrl, { 
            waitUntil: "domcontentloaded", 
            timeout: 20000 
          });
          
          // Минимальная задержка для загрузки
          await delay(100); // Уменьшаем с 300 до 100мс
          
          // Проверяем что страница загрузилась
          const pageTitle = await page.title();
          console.log(`🌐 Заголовок страницы: ${pageTitle}`);
          
          // Проверяем есть ли сообщение "По вашему запросу ничего не найдено"
          const noResultsMessage = await page.evaluate(() => {
            const noResults = document.querySelector('[data-qa="bloko-header-3"]') ||
                             document.querySelector('.bloko-header-3') ||
                             document.querySelector('[class*="nothing-found"]');
            return noResults ? noResults.textContent : null;
          });
          
          if (noResultsMessage && noResultsMessage.includes('ничего не найдено')) {
            console.log(`⚠️ Запрос "${searchText}" исчерпан - нет результатов`);
            hasMorePages = false;
            break;
          }
          
          // Парсим вакансии со страницы
          const vacancies = await page.evaluate(() => {
            // Пробуем разные селекторы для максимального охвата
            let items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]');
            
            // Если не нашли, пробуем альтернативные селекторы
            if (items.length === 0) {
              items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy_standard"]');
            }
            if (items.length === 0) {
              items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy_premium"]');
            }
            if (items.length === 0) {
              items = document.querySelectorAll('.vacancy-serp-item');
            }
            if (items.length === 0) {
              items = document.querySelectorAll('[class*="vacancy-serp"]');
            }
            if (items.length === 0) {
              // Последняя попытка - ищем все карточки вакансий
              items = document.querySelectorAll('[data-qa*="vacancy"]');
            }
            if (items.length === 0) {
              // Еще один вариант - ищем по структуре
              items = document.querySelectorAll('div[data-qa*="serp"] > div');
            }
            if (items.length === 0) {
              // Ищем по классам
              items = document.querySelectorAll('.serp-item, .vacancy-item, [class*="vacancy"]');
            }
            
            console.log(`Найдено элементов на странице: ${items.length}`);
            
            // Логируем структуру если ничего не нашли
            if (items.length === 0) {
              console.log(`HTML страницы (первые 1000 символов): ${document.body.innerHTML.substring(0, 1000)}`);
            }
            
            return Array.from(items).map(item => {
              // Пробуем разные селекторы для заголовка
              let titleEl = item.querySelector('[data-qa="serp-item__title"]');
              if (!titleEl) titleEl = item.querySelector('[data-qa="bloko-header-2"]');
              if (!titleEl) titleEl = item.querySelector('a[href*="/vacancy/"]');
              if (!titleEl) titleEl = item.querySelector('h3 a');
              if (!titleEl) titleEl = item.querySelector('a');
              
              const companyEl = item.querySelector('[data-qa="vacancy-serp__vacancy-employer"]') ||
                               item.querySelector('[data-qa="vacancy-serp__vacancy-employer-link"]') ||
                               item.querySelector('[class*="employer"]');
              const salaryEl = item.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]') ||
                              item.querySelector('[class*="compensation"]') ||
                              item.querySelector('[class*="salary"]');
              
              let vacancyId = null;
              const href = titleEl?.href || item.querySelector('a[href*="/vacancy/"]')?.href;
              if (href) {
                const match = href.match(/vacancy\/(\d+)/);
                vacancyId = match ? parseInt(match[1]) : null;
              }

              const text = item.innerText || '';
              let status = null;
              // Проверяем ТОЧНЫЕ фразы об уже отправленном отклике
              // НЕ используем просто "Отклик" - это слово есть в кнопке "Откликнуться"
              if (text.includes('Вы откликнулись') || 
                  text.includes('Резюме отправлено') || 
                  text.includes('Отклик отправлен') ||
                  text.includes('Вы уже откликались') ||
                  text.includes('Вам отказали') ||
                  text.includes('Вас пригласили') ||
                  text.includes('Приглашение') ||
                  text.includes('Отказ')) {
                status = 'already_applied';
              }

              return {
                vacancy_id: vacancyId,
                title: titleEl?.innerText?.trim() || "Без названия",
                company: companyEl?.innerText?.trim() || "Не указана",
                link: href?.split('?')[0] || null,
                salary: salaryEl?.innerText?.trim() || null,
                status_on_list_page: status
              };
            }).filter(v => v.vacancy_id && v.link);
          });

          console.log(`🌐 Найдено валидных вакансий на странице: ${vacancies.length}`);

          // Если страница пустая - запрос исчерпан
          if (vacancies.length === 0) {
            console.log(`📄 Стр.${pageNum + 1} | ПУСТАЯ - запрос "${searchText}" полностью обработан`);
            hasMorePages = false;
            break;
          }

          // Фильтруем новые вакансии (не дубли, не откликнутые, не откликнутые с других резюме)
          const newVacancies = vacancies.filter(v => {
            if (v.status_on_list_page) return false;
            if (vacancyIdCache.has(v.vacancy_id)) return false;
            if (appliedFromOtherResumesCache.has(v.vacancy_id)) return false;
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
          
          // Отправляем обновление прогресса для фронтенда
          console.log(`PARSING_PROGRESS: ${JSON.stringify({ parsed: currentCount, target: TARGET_VACANCIES })}`);

          pageNum++;
          
          // Убираем задержку полностью для максимальной скорости
          
        } catch (e) {
          console.warn(`⚠️ Стр.${pageNum + 1} ошибка: ${e.message.slice(0, 50)}`);
          // При ошибке пробуем следующую страницу
          pageNum++;
          // Убираем задержку при ошибках для ускорения
          
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
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000); // в секундах
    const vacanciesPerMinute = Math.round((totalCount / duration) * 60);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ ПАРСИНГ ПОЛНОСТЬЮ ЗАВЕРШЕН`);
    console.log(`📊 Всего собрано: ${totalCount} вакансий`);
    console.log(`🎯 Цель была: ${TARGET_VACANCIES}`);
    console.log(`⏱️ Время парсинга: ${duration} сек`);
    console.log(`🚀 Скорость: ${vacanciesPerMinute} вакансий/мин`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Прогресс: ${totalCount}/${TARGET_VACANCIES}`);
    
    // Отправляем финальный прогресс для фронтенда
    console.log(`PARSING_PROGRESS: ${JSON.stringify({ parsed: totalCount, target: TARGET_VACANCIES })}`);
    
  } catch (error) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА:", error.message);
  }
}

export { parseHHVacanciesWithBrowser as parseVacancies };
