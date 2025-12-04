#!/usr/bin/env node
// main.js - Главный файл приложения

import puppeteer from 'puppeteer';
import cliProgress from 'cli-progress';
import logUpdate from 'log-update';

import { config } from './config/index.js';
import { initializeDatabase, dbAll, dbRun } from './db/database.js';
import { parseHHVacanciesWithBrowser } from './parser/index.js';
import { applyToVacancySimple } from './applicator/simple.js';
import { calculateVacancyRelevance } from './services/filter.js';

/**
 * Автоматизированный процесс парсинга и отклика
 */
async function runAutomatedProcess() {
  logUpdate("🚀 Запуск автоматического процесса парсинга и отклика...");

  const originalQuery = config.search.query;
  const originalArea = config.search.area;

  while (true) {
    let shouldPauseForRateLimit = false;
    
    try {
      console.log("\n--- Запуск нового цикла автоматизации ---");

      await initializeDatabase();

      // Очистка БД перед каждым циклом
      console.log("\n🗑️  Очистка базы данных...");
      await dbRun('DELETE FROM survey_answers');
      await dbRun('DELETE FROM vacancy_details');
      await dbRun('DELETE FROM vacancies');
      await dbRun('DELETE FROM sqlite_sequence');
      console.log("✅ База данных очищена\n");

      // Фаза 1: Парсинг
      console.log("\n======================================================");
      console.log("1. ФАЗА ПАРСИНГА: Сбор 1000 вакансий БЕЗ откликов...");
      console.log("======================================================");
      
      console.log('🌐 Открываем браузер...');
      const mainBrowser = await puppeteer.launch({
        headless: config.puppeteer.headless,
        slowMo: config.puppeteer.slowMo || 0,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: config.puppeteer.defaultViewport || { width: 1280, height: 800 }
      });
      
      const mainPage = await mainBrowser.newPage();
      await mainPage.setViewport(config.puppeteer.defaultViewport || { width: 1280, height: 800 });
      
      console.log('\n⏳ ВОЙДИ В АККАУНТ HH.RU В БРАУЗЕРЕ');
      console.log('У тебя есть 1 МИНУТА...\n');
      
      await mainPage.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      for (let i = 60; i > 0; i -= 10) {
        console.log(`⏳ Осталось ${i} секунд для входа...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      console.log('\n✅ Время вышло. Начинаем парсинг...\n');
      
      await parseHHVacanciesWithBrowser(mainBrowser, mainPage);
      
      console.log("\n======================================================");
      console.log("✅ ФАЗА ПАРСИНГА ЗАВЕРШЕНА");
      console.log("======================================================");

      // Фаза 2: Рейтинг
      console.log("\n======================================================");
      console.log("2. ФАЗА РЕЙТИНГА: Сортировка по релевантности...");
      console.log("======================================================");
      
      const TARGET = 350;
      
      console.log('\n🔍 Получаем вакансии БЕЗ откликов...');
      const allNewVacancies = await dbAll(
        `SELECT * FROM vacancies 
         WHERE (status IS NULL OR status = 'new')
         ORDER BY relevance_score DESC`,
        []
      );
      
      const allVacanciesCount = await dbAll(`SELECT COUNT(*) as count FROM vacancies`, []);
      const withResponseCount = await dbAll(
        `SELECT COUNT(*) as count FROM vacancies 
         WHERE status IN ('already_applied_hh', 'invited_hh', 'rejected_hh', 'applied', 'already_responded')`,
        []
      );
      
      console.log(`\n📊 СТАТИСТИКА:`);
      console.log(`   Всего в БД: ${allVacanciesCount[0].count}`);
      console.log(`   С откликами: ${withResponseCount[0].count}`);
      console.log(`   БЕЗ откликов: ${allNewVacancies.length}`);
      
      if (allNewVacancies.length === 0) {
        console.log('\n❌ НЕТ вакансий без откликов!');
        console.log('Ждем 4 часа перед следующим циклом...');
        await new Promise(resolve => setTimeout(resolve, 240 * 60 * 1000));
        continue;
      }
      
      // Берем РОВНО 350 вакансий - отсортированы по score DESC
      const top350 = allNewVacancies.slice(0, TARGET);
      
      console.log(`\n✅ ОТОБРАНО РОВНО ${top350.length} ВАКАНСИЙ`);
      console.log(`\n📋 ТОП-${top350.length} ВАКАНСИЙ:\n`);
      
      for (let i = 0; i < top350.length; i++) {
        const v = top350[i];
        console.log(`${i+1}. [${v.relevance_score || 0}] ${v.title} | ${v.company}`);
        
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
      
      console.log("\n======================================================");
      console.log("✅ ФАЗА РЕЙТИНГА ЗАВЕРШЕНА");
      console.log("======================================================");

      // Фаза 3: Отклик
      console.log("\n======================================================");
      console.log("3. ФАЗА ОТКЛИКА: Отправка откликов...");
      console.log("======================================================");
      
      if (process.stdout.isTTY === false) {
        process.stdout.write("ФАЗА ОТКЛИКА\n");
      }

      const topVacancies = top350;
      console.log(`🎯 Начинаем отклики на ${topVacancies.length} вакансий`);

      const applyProgressBar = new cliProgress.SingleBar({
        format: 'Отклик |{bar}| {percentage}% | {value}/{total} | {title}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      }, cliProgress.Presets.shades_classic);
      
      applyProgressBar.start(topVacancies.length, 0, { title: 'N/A' });

      let appliedCount = 0;
      let successCount = 0;
      let failedCount = 0;
      
      console.log('\n🚀 Используем тот же браузер для откликов...\n');
      
      let browser = mainBrowser;
      let page = mainPage;
      const resumeConfig = config.resumes[0];
      
      for (const vacancy of topVacancies) {
        appliedCount++;
        const relevanceInfo = vacancy.relevance_score ? ` [🎯 ${vacancy.relevance_score}]` : '';
        applyProgressBar.update(appliedCount, { title: vacancy.title + relevanceInfo });

        try {
          page = await browser.newPage();
          await page.setViewport(config.puppeteer.defaultViewport || { width: 1280, height: 800 });
        } catch (e) {
          console.error('❌ Не удалось создать страницу:', e.message);
          continue;
        }

        const applyResult = await applyToVacancySimple(vacancy, browser, page, resumeConfig);
        
        try {
          await page.close();
        } catch (e) {}
        
        applyProgressBar.stop();
        
        if (applyResult.success) {
          successCount++;
          console.log(`\n✅ Отклик ${appliedCount}/${topVacancies.length}: "${vacancy.title}" - УСПЕШНО`);
        } else {
          failedCount++;
          console.log(`\n❌ Отклик ${appliedCount}/${topVacancies.length}: "${vacancy.title}" - ОШИБКА (${applyResult.reason || 'неизвестно'})`);
        }
        
        console.log(`📊 Статистика: успешно=${successCount} ошибок=${failedCount} всего=${appliedCount}/${topVacancies.length}`);
        
        if (process.stdout.isTTY === false) {
          process.stdout.write(`Статистика: успешно=${successCount} ошибок=${failedCount} всего=${appliedCount}/${topVacancies.length}\n`);
        }
        
        if (appliedCount < topVacancies.length) {
          applyProgressBar.start(topVacancies.length, appliedCount, { title: 'Следующая...' });
        }

        if (!applyResult.success && (applyResult.reason === "rate_limit_exceeded" || applyResult.reason === "gemini_quota_exceeded")) {
          console.log("🚨 Превышен лимит. Приостанавливаем процесс.");
          shouldPauseForRateLimit = true;
          break;
        }
      }
      
      if (mainBrowser) {
        try {
          await mainBrowser.close();
          console.log('\n✅ Браузер закрыт');
        } catch (closeError) {
          console.warn('⚠️ Ошибка закрытия браузера:', closeError.message);
        }
      }
      
      try { applyProgressBar.stop(); } catch (e) {}
      
      console.log("\n======================================================");
      console.log("✅ ФАЗА ОТКЛИКА ЗАВЕРШЕНА.");
      console.log(`📊 ИТОГО: ${appliedCount}/${topVacancies.length} | ✅ ${successCount} | ❌ ${failedCount}`);
      console.log("======================================================");

      if (shouldPauseForRateLimit) {
        const rateLimitPauseHours = 25;
        console.log(`\n🚫 Превышен лимит. Пауза на ${rateLimitPauseHours} часов.`);
        await new Promise(resolve => setTimeout(resolve, rateLimitPauseHours * 60 * 60 * 1000));
        continue;
      }

      const cycleDelayMinutes = 240;
      console.log(`\nСледующий цикл через ${cycleDelayMinutes} минут.`);
      await new Promise(resolve => setTimeout(resolve, cycleDelayMinutes * 60 * 1000));

    } catch (error) {
      console.error("\n❌ Критическая ошибка:", error.message);
      console.error("Повторная попытка через 5 минут...");
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    } finally {
      config.search.query = originalQuery;
      config.search.area = originalArea;
    }
  }
}

async function main() {
  try {
    console.clear();
    console.log("=== HH.ru Auto Parser ===");
    await runAutomatedProcess();
  } catch (error) {
    console.error("Произошла ошибка:", error.message);
    process.exit(1);
  }
}

main();
