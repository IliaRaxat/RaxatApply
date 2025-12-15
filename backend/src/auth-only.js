#!/usr/bin/env node
// auth-only.js - Только проверка авторизации

import puppeteer from 'puppeteer';

async function authOnly() {
  console.log("=== ТОЛЬКО АВТОРИЗАЦИЯ ===");
  console.log("🚀 Запуск...");
  
  let browser = null;
  
  try {
    // 1. Запуск браузера
    console.log("\n🌐 Открываем браузер...");
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 2. Переходим на главную страницу
    console.log("\n🏠 Переход на hh.ru...");
    await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 3. Ждём авторизации
    console.log("\n⏳ ВОЙДИ В АККАУНТ HH.RU В БРАУЗЕРЕ");
    console.log("У тебя есть строго 5 минут (300 секунд) для авторизации...\n");
    
    // Ждём строго 5 минут (300 секунд) для ручной авторизации
    const totalSeconds = 300;
    for (let i = totalSeconds; i > 0; i -= 10) {
      console.log(`⏳ Осталось ${i} секунд из ${totalSeconds}...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // 4. Проверяем авторизацию
    console.log("\n🔍 Проверяем авторизацию...");
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
      console.log("🎉 Теперь можно запускать основную программу!");
    } else {
      console.log("❌ Авторизация не выполнена!");
      console.log("⚠️ Попробуй снова или проверь данные для входа");
    }
    
    console.log("\n⚠️ БРАУЗЕР ОСТАНЕТСЯ ОТКРЫТЫМ!");
    console.log("Закрой его вручную после проверки.");
    
  } catch (error) {
    console.error("\n❌ ОШИБКА:", error.message);
    console.error(error.stack);
    
    // Не закрываем браузер при ошибке для диагностики
    console.log("\n⚠️ БРАУЗЕР ОСТАНЕТСЯ ОТКРЫТЫМ ДЛЯ ДИАГНОСТИКИ!");
    console.log("Закрой его вручную после проверки.");
  }
}

authOnly();