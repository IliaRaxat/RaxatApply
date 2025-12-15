#!/usr/bin/env node
// DEBUG_FIRST_RESUME.js - Специальный скрипт для диагностики первого резюме

import puppeteer from 'puppeteer';
import { config } from './backend/src/config/index.js';
import { initializeDatabase, dbRun, dbAll } from './backend/src/db/database.js';

async function debugFirstResume() {
  console.log("=== ДИАГНОСТИКА ПЕРВОГО РЕЗЮМЕ ===");
  
  // Получаем конфигурацию первого резюме
  const resumeConfig = config.resumes.find(r => r.id == 1) || config.resumes[0];
  console.log(`📋 Резюме: ${resumeConfig.name} (ID: ${resumeConfig.id})`);
  console.log(`📧 Email: ${resumeConfig.email}`);
  console.log(`🔑 Password: ${resumeConfig.password ? "[УКАЗАН]" : "[НЕТ]"}`);
  console.log(`🍪 Токены: HHTOKEN="${resumeConfig.cookies.HHTOKEN}", XSRF="${resumeConfig.cookies.XSRF}"`);
  
  // Проверяем базу данных
  console.log("\n=== ПРОВЕРКА БАЗЫ ДАННЫХ ===");
  try {
    await initializeDatabase();
    const vacancyCount = await dbAll('SELECT COUNT(*) as count FROM vacancies', []);
    const blacklistCount = await dbAll('SELECT COUNT(*) as count FROM blacklisted_vacancies', []);
    console.log(`📊 Вакансий в БД: ${vacancyCount[0]?.count || 0}`);
    console.log(`🚫 Вакансий в черном списке: ${blacklistCount[0]?.count || 0}`);
  } catch (dbError) {
    console.log(`❌ Ошибка БД: ${dbError.message}`);
  }
  
  // Проверяем браузер
  console.log("\n=== ПРОВЕРКА БРАУЗЕРА ===");
  let browser = null;
  try {
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
    console.log("✅ Браузер запущен успешно");
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    console.log("✅ Страница создана");
    
    // Переходим на hh.ru
    console.log("\n=== ПРОВЕРКА САЙТА ===");
    await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log("✅ Страница hh.ru загружена");
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await browser.close();
    console.log("✅ Браузер закрыт");
  } catch (browserError) {
    console.log(`❌ Ошибка браузера: ${browserError.message}`);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.log(`❌ Ошибка закрытия браузера: ${closeError.message}`);
      }
    }
  }
  
  console.log("\n=== ДИАГНОСТИКА ЗАВЕРШЕНА ===");
}

debugFirstResume().catch(console.error);