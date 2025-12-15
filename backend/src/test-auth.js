#!/usr/bin/env node
// test-auth.js - Тестовый скрипт для проверки авторизации

import puppeteer from 'puppeteer';
import { config } from './config/index.js';

async function testAuth() {
  console.log("=== Тест авторизации HH.ru ===");
  
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
    await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Проверяем, переданы ли токены через переменные окружения
    const hhToken = process.env.HH_TOKEN;
    const xsrf = process.env.XSRF;
    
    if (hhToken && xsrf) {
      console.log("✅ Токены получены из переменных окружения");
      // Устанавливаем куки
      await page.setCookie(
        { name: 'HHTOKEN', value: hhToken, domain: '.hh.ru', path: '/' },
        { name: 'XSRF-TOKEN', value: xsrf, domain: '.hh.ru', path: '/' }
      );
      console.log("🍪 Куки установлены");
      console.log("🏠 Перешли на главную страницу");
    } else {
      console.log("⚠️ Токены не найдены, ждём ручной авторизации...");
      console.log("🏠 Перешли на главную страницу");

      // Ждём строго 5 минут (300 секунд) для авторизации
      const totalSeconds = 300;
      for (let i = totalSeconds; i > 0; i -= 5) {
        console.log(`⏳ Осталось ${i} секунд из ${totalSeconds} для авторизации...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
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
    
    // Ждём 10 секунд, чтобы можно было проверить
    console.log("⏳ Ждём 10 секунд для проверки...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error("❌ Ошибка:", error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("\n✅ Браузер закрыт");
      } catch (e) {}
    }
  }
}

testAuth();