#!/usr/bin/env node
// test-apply.js - Тестовый скрипт для отладки откликов

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаём папку для скриншотов
const screenshotsDir = path.join(__dirname, '../screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
  const filename = path.join(screenshotsDir, `${Date.now()}_${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 Скриншот: ${filename}`);
}

async function testApply() {
  console.log("=== ТЕСТ ОТКЛИКА НА HH.RU ===\n");
  
  let browser = null;
  
  try {
    // 1. Запуск браузера
    console.log("🌐 Открываем браузер...");
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
      defaultViewport: null // Используем размер окна
    });

    const page = await browser.newPage();
    
    // 2. Переходим на HH.ru
    console.log("\n📄 Переходим на hh.ru...");
    await page.goto('https://hh.ru', { waitUntil: 'networkidle2', timeout: 60000 });
    await takeScreenshot(page, '01_hh_main');
    
    // 3. Ждём авторизации
    console.log("\n⏳ ВОЙДИ В АККАУНТ HH.RU В БРАУЗЕРЕ");
    console.log("У тебя есть 300 секунд...\n");
    
    // Переходим на главную страницу
    await page.goto('https://hh.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Ждём 300 секунд для авторизации
    for (let i = 300; i > 0; i -= 15) {
      console.log(`⏳ Осталось ${i} секунд...`);
      await sleep(15000);
    }

    await takeScreenshot(page, '02_after_login');
    
    // 4. Проверяем авторизацию
    const isLoggedIn = await page.evaluate(() => {
      return document.body.innerText.includes('Мои резюме') || 
             document.body.innerText.includes('Выход') ||
             document.querySelector('[data-qa="mainmenu_myResumes"]') !== null;
    });
    
    console.log(`\n🔐 Авторизация: ${isLoggedIn ? 'ДА' : 'НЕТ'}`);
    
    if (!isLoggedIn) {
      console.log("❌ Ты не авторизован! Авторизуйся и запусти снова.");
      await browser.close();
      return;
    }
    
    // 5. Ищем вакансию
    console.log("\n🔍 Ищем вакансию для теста...");
    await page.goto('https://hh.ru/search/vacancy?text=frontend&area=1&items_on_page=20', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    await sleep(2000);
    await takeScreenshot(page, '03_search_results');
    
    // 6. Находим первую вакансию БЕЗ отклика
    const vacancyLink = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]');
      for (const item of items) {
        const text = item.innerText || '';
        // Пропускаем если уже откликнулись
        if (text.includes('Вы откликнулись') || 
            text.includes('Отклик отправлен') ||
            text.includes('Не просмотрен') ||
            text.includes('Просмотрен')) {
          continue;
        }
        const link = item.querySelector('[data-qa="serp-item__title"]');
        if (link && link.href) {
          return link.href.split('?')[0];
        }
      }
      return null;
    });
    
    if (!vacancyLink) {
      console.log("❌ Не найдено вакансий без отклика!");
      await browser.close();
      return;
    }
    
    console.log(`\n✅ Найдена вакансия: ${vacancyLink}`);
    
    // 7. Открываем вакансию
    console.log("\n📄 Открываем страницу вакансии...");
    await page.goto(vacancyLink, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);
    await takeScreenshot(page, '04_vacancy_page');
    
    // 8. Проверяем наличие кнопки
    const buttonInfo = await page.evaluate(() => {
      const btn = document.querySelector('[data-qa="vacancy-response-link-top"]');
      if (btn) {
        return {
          exists: true,
          text: btn.innerText,
          visible: btn.offsetParent !== null,
          rect: btn.getBoundingClientRect()
        };
      }
      
      // Ищем другие кнопки отклика
      const allButtons = document.querySelectorAll('button, a');
      const responseButtons = [];
      for (const b of allButtons) {
        if (b.innerText && b.innerText.toLowerCase().includes('откликнуться')) {
          responseButtons.push({
            tag: b.tagName,
            text: b.innerText,
            dataQa: b.getAttribute('data-qa'),
            className: b.className
          });
        }
      }
      
      return {
        exists: false,
        alternatives: responseButtons
      };
    });
    
    console.log("\n🔘 Информация о кнопке:");
    console.log(JSON.stringify(buttonInfo, null, 2));
    
    if (!buttonInfo.exists) {
      console.log("❌ Кнопка 'Откликнуться' не найдена!");
      await browser.close();
      return;
    }
    
    // 9. Кликаем на кнопку
    console.log("\n👆 Кликаем на кнопку 'Откликнуться'...");
    
    const responseButton = await page.$('[data-qa="vacancy-response-link-top"]');
    await responseButton.click();
    
    console.log("✅ Клик выполнен, ждём 5 секунд...");
    await sleep(5000);
    await takeScreenshot(page, '05_after_click');
    
    // 10. Проверяем что появилось
    const afterClickInfo = await page.evaluate(() => {
      const result = {
        pageText: document.body.innerText.substring(0, 500),
        hasPopup: false,
        popupContent: null,
        hasSuccessMessage: false
      };
      
      // Проверяем popup
      const popup = document.querySelector('[data-qa="vacancy-response-popup"]') ||
                    document.querySelector('[role="dialog"]') ||
                    document.querySelector('[class*="bloko-modal"]');
      
      if (popup) {
        result.hasPopup = true;
        result.popupContent = popup.innerText.substring(0, 300);
      }
      
      // Проверяем успех
      const text = document.body.innerText;
      result.hasSuccessMessage = text.includes('Отклик отправлен') || 
                                  text.includes('Вы откликнулись');
      
      return result;
    });
    
    console.log("\n📋 После клика:");
    console.log(`- Popup: ${afterClickInfo.hasPopup ? 'ДА' : 'НЕТ'}`);
    console.log(`- Успех: ${afterClickInfo.hasSuccessMessage ? 'ДА' : 'НЕТ'}`);
    
    if (afterClickInfo.hasPopup) {
      console.log(`- Содержимое popup: ${afterClickInfo.popupContent}`);
      
      // 11. Ищем кнопку отправки в popup
      const submitBtn = await page.$('button[data-qa="vacancy-response-submit-popup"]');
      if (submitBtn) {
        console.log("\n👆 Найдена кнопка отправки, кликаем...");
        await submitBtn.click();
        await sleep(3000);
        await takeScreenshot(page, '06_after_submit');
      } else {
        console.log("\n⚠️ Кнопка отправки не найдена в popup");
        
        // Выводим все кнопки в popup
        const popupButtons = await page.evaluate(() => {
          const popup = document.querySelector('[data-qa="vacancy-response-popup"]') ||
                        document.querySelector('[role="dialog"]');
          if (!popup) return [];
          
          const buttons = popup.querySelectorAll('button');
          return Array.from(buttons).map(b => ({
            text: b.innerText,
            dataQa: b.getAttribute('data-qa'),
            type: b.type,
            className: b.className
          }));
        });
        
        console.log("Кнопки в popup:", JSON.stringify(popupButtons, null, 2));
      }
    }
    
    // 12. Финальная проверка
    await sleep(2000);
    await takeScreenshot(page, '07_final');
    
    const finalCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        success: text.includes('Отклик отправлен') || text.includes('Вы откликнулись'),
        pageTitle: document.title
      };
    });
    
    console.log(`\n🏁 РЕЗУЛЬТАТ: ${finalCheck.success ? '✅ УСПЕХ' : '❌ НЕ УДАЛОСЬ'}`);
    
    // Ждём перед закрытием
    console.log("\n⏳ Браузер закроется через 10 секунд...");
    await sleep(10000);
    
  } catch (error) {
    console.error("\n❌ ОШИБКА:", error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n✅ Браузер закрыт");
    }
  }
}

testApply();
