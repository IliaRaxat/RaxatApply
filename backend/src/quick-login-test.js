#!/usr/bin/env node
// quick-login-test.js - Быстрый тест авторизации без закрытия браузера

import puppeteer from 'puppeteer';

async function quickLoginTest() {
  console.log("=== БЫСТРЫЙ ТЕСТ АВТОРИЗАЦИИ ===");
  
  let browser = null;
  
  try {
    // Запуск браузера
    console.log("\n🌐 Открываем браузер...");
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Переходим на главную страницу
    console.log("🏠 Переход на hh.ru...");
    await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log("\n⏳ ВОЙДИ В АККАУНТ HH.RU В БРАУЗЕРЕ");
    console.log("У тебя есть строго 5 минут (300 секунд) для авторизации...\n");
    
    // Ждём строго 5 минут (300 секунд) для авторизации
    const totalSeconds = 300;
    for (let i = totalSeconds; i > 0; i -= 10) {
      console.log(`⏳ Осталось ${i} секунд из ${totalSeconds}...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Проверяем, залогинены ли мы
    const isLoggedIn = await page.evaluate(() => {
      // Ищем элементы, которые есть только у залогиненного пользователя
      const profileLink = document.querySelector('[data-qa="account-switcher"]') || 
                         document.querySelector('[data-qa="user-menu"]') ||
                         document.querySelector('[class*="user-menu"]') ||
                         document.querySelector('a[href*="/applicant"]') ||
                         document.querySelector('a[href*="/resume"]');
      
      return !!profileLink;
    });
    
    if (isLoggedIn) {
      console.log("✅ Авторизация успешна!");
    } else {
      console.log("❌ Авторизация не удалась");
    }
    
    console.log("\n⚠️  БРАУЗЕР ОСТАНЕТСЯ ОТКРЫТЫМ!");
    console.log("Закрой его вручную после проверки.");
    
  } catch (error) {
    console.error("❌ Ошибка:", error.message);
    console.error(error.stack);
    
    // Не закрываем браузер при ошибке для диагностики
    console.log("\n⚠️  БРАУЗЕР ОСТАНЕТСЯ ОТКРЫТЫМ ДЛЯ ДИАГНОСТИКИ!");
    console.log("Закрой его вручную после проверки.");
  }
}

quickLoginTest();