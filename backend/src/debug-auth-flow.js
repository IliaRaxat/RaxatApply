#!/usr/bin/env node
// debug-auth-flow.js - Подробная отладка процесса авторизации

import puppeteer from 'puppeteer';

async function debugAuthFlow() {
  console.log("=== ПОДРОБНАЯ ОТЛАДКА АВТОРИЗАЦИИ ===");
  
  let browser = null;
  
  try {
    // 1. Запуск браузера
    console.log("\n1. 🌐 Открываем браузер...");
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
    console.log("✅ Браузер открыт");

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    console.log("✅ Страница создана");

    // 2. Переходим на главную страницу
    console.log("\n2. 🏠 Переход на hh.ru...");
    await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log("✅ Переход выполнен");
    
    // Проверяем текущий URL
    const currentUrl = page.url();
    console.log(`📍 Текущий URL: ${currentUrl}`);

    // 3. Проверяем наличие элементов авторизации
    console.log("\n3. 🔍 Проверяем элементы авторизации...");
    
    const accountSwitcher = await page.$('[data-qa="account-switcher"]');
    const userMenu = await page.$('[data-qa="user-menu"]');
    const loginButton = await page.$('[data-qa="login"]');
    const profileLink = await page.$('a[href*="/applicant"]') || await page.$('a[href*="/resume"]');
    
    console.log(`📊 Результаты проверки:`);
    console.log(`   - Account Switcher: ${!!accountSwitcher}`);
    console.log(`   - User Menu: ${!!userMenu}`);
    console.log(`   - Login Button: ${!!loginButton}`);
    console.log(`   - Profile Link: ${!!profileLink}`);
    
    if (accountSwitcher || userMenu || profileLink) {
      console.log("✅ Уже авторизован!");
    } else {
      console.log("⚠️ Не авторизован");
      
      // Ждем немного и проверяем снова
      console.log("\n4. ⏳ Ждем 30 секунд для ручной авторизации...");
      for (let i = 30; i > 0; i--) {
        console.log(`⏳ Осталось ${i} секунд...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Повторная проверка
      console.log("\n5. 🔍 Повторная проверка авторизации...");
      const accountSwitcher2 = await page.$('[data-qa="account-switcher"]');
      const userMenu2 = await page.$('[data-qa="user-menu"]');
      const profileLink2 = await page.$('a[href*="/applicant"]') || await page.$('a[href*="/resume"]');
      
      console.log(`📊 Результаты повторной проверки:`);
      console.log(`   - Account Switcher: ${!!accountSwitcher2}`);
      console.log(`   - User Menu: ${!!userMenu2}`);
      console.log(`   - Profile Link: ${!!profileLink2}`);
      
      if (accountSwitcher2 || userMenu2 || profileLink2) {
        console.log("✅ Авторизация выполнена!");
      } else {
        console.log("❌ Авторизация не выполнена");
      }
    }
    
    console.log("\n⚠️ БРАУЗЕР ОСТАНЕТСЯ ОТКРЫТЫМ!");
    console.log("Закрой его вручную после проверки.");
    
  } catch (error) {
    console.error("\n❌ ОШИБКА:", error.message);
    console.error(error.stack);
    
    console.log("\n⚠️ БРАУЗЕР ОСТАНЕТСЯ ОТКРЫТЫМ ДЛЯ ДИАГНОСТИКИ!");
    console.log("Закрой его вручную после проверки.");
  }
}

debugAuthFlow();