#!/usr/bin/env node
// debug-modals.js - Скрипт для отладки модальных окон

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

async function debugModals() {
  console.log("=== ДЕБАГ МОДАЛЬНЫХ ОКОН НА HH.RU ===\n");
  
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
    
    // 5. Ищем вакансию с модальным окном
    console.log("\n🔍 Ищем вакансию с модальным окном...");
    await page.goto('https://hh.ru/search/vacancy?text=frontend&area=1&items_on_page=20', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    await sleep(2000);
    await takeScreenshot(page, '03_search_results');
    
    // 6. Находим вакансию БЕЗ отклика
    const vacancyLinks = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"]');
      const links = [];
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
          links.push(link.href.split('?')[0]);
        }
      }
      return links.slice(0, 5); // Берем первые 5 вакансий
    });
    
    if (!vacancyLinks || vacancyLinks.length === 0) {
      console.log("❌ Не найдено вакансий без отклика!");
      await browser.close();
      return;
    }
    
    console.log(`\n✅ Найдено вакансий: ${vacancyLinks.length}`);
    
    // 7. Проверяем каждую вакансию
    for (let i = 0; i < vacancyLinks.length; i++) {
      const vacancyLink = vacancyLinks[i];
      console.log(`\n📄 Открываем страницу вакансии ${i + 1}/${vacancyLinks.length}: ${vacancyLink}`);
      await page.goto(vacancyLink, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(3000);
      await takeScreenshot(page, `04_vacancy_page_${i + 1}`);
      
      // 8. Проверяем наличие кнопки отклика
      const buttonInfo = await page.evaluate(() => {
        // Ищем все возможные кнопки отклика
        const selectors = [
          '[data-qa="vacancy-response-link-top"]',
          '[data-qa="vacancy-response-link-bottom"]',
          '[data-qa="vacancy-response-link"]'
        ];
        
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            return {
              exists: true,
              selector: sel,
              text: btn.innerText,
              visible: btn.offsetParent !== null,
              rect: btn.getBoundingClientRect()
            };
          }
        }
        
        // Ищем по тексту "Откликнуться"
        const allElements = document.querySelectorAll('a, button, span');
        for (const el of allElements) {
          const text = el.innerText || el.textContent || '';
          if (text.trim() === 'Откликнуться') {
            return {
              exists: true,
              selector: 'text:Откликнуться',
              text: text,
              visible: el.offsetParent !== null,
              rect: el.getBoundingClientRect()
            };
          }
        }
        
        return {
          exists: false
        };
      });
      
      console.log(`\n🔘 Информация о кнопке:`);
      console.log(JSON.stringify(buttonInfo, null, 2));
      
      if (!buttonInfo.exists) {
        console.log("❌ Кнопка 'Откликнуться' не найдена!");
        continue;
      }
      
      // 9. Кликаем на кнопку
      console.log("\n👆 Кликаем на кнопку 'Откликнуться'...");
      
      // Используем тот же селектор, который нашли
      if (buttonInfo.selector.startsWith('text:')) {
        // Ищем по тексту
        await page.evaluate(() => {
          const allElements = document.querySelectorAll('a, button, span');
          for (const el of allElements) {
            const text = el.innerText || el.textContent || '';
            if (text.trim() === 'Откликнуться') {
              el.scrollIntoView({ block: 'center' });
              el.click();
              break;
            }
          }
        });
      } else {
        // Используем селектор
        const responseButton = await page.$(buttonInfo.selector);
        if (responseButton) {
          await responseButton.click();
        }
      }
      
      console.log("✅ Клик выполнен, ждём 5 секунд...");
      await sleep(5000);
      await takeScreenshot(page, `05_after_click_${i + 1}`);
      
      // 10. Проверяем что появилось
      const modalInfo = await page.evaluate(() => {
        const result = {
          pageText: document.body.innerText.substring(0, 500),
          hasPopup: false,
          popupContent: null,
          popupSelectors: [],
          hasLetterField: false,
          letterFieldSelectors: [],
          hasSubmitButton: false,
          submitButtonSelectors: [],
          hasSuccessMessage: false
        };
        
        // Проверяем popup/modal
        const popupSelectors = [
          '[data-qa="vacancy-response-popup"]',
          '[role="dialog"]',
          '[class*="bloko-modal"]',
          '.vacancy-response-popup',
          '.popup',
          '[data-qa*="popup"]',
          '[data-qa*="modal"]'
        ];
        
        for (const sel of popupSelectors) {
          const popup = document.querySelector(sel);
          if (popup) {
            result.hasPopup = true;
            result.popupSelectors.push(sel);
            result.popupContent = popup.innerText.substring(0, 300);
            break;
          }
        }
        
        // Проверяем поле для сопроводительного письма
        const letterSelectors = [
          '[data-qa="vacancy-response-letter-text"]',
          'textarea[name="letter"]',
          '[data-qa="vacancy-response-popup-form-letter-input"]',
          'textarea[data-qa*="letter"]',
          '.vacancy-response-popup-form textarea',
          'textarea[placeholder*="Сопроводительное"]',
          'textarea[placeholder*="Cover"]'
        ];
        
        for (const sel of letterSelectors) {
          const field = document.querySelector(sel);
          if (field) {
            result.hasLetterField = true;
            result.letterFieldSelectors.push(sel);
          }
        }
        
        // Проверяем кнопки отправки
        const submitSelectors = [
          'button[data-qa="vacancy-response-submit-popup"]',
          'button[data-qa="vacancy-response-letter-submit"]',
          'button[data-qa="relocation-warning-confirm"]',
          'button[type="submit"]',
          'button[data-qa="vacancy-response-popup-close"]',
          '.bloko-modal-footer button:not([data-qa*="cancel"]):not([data-qa*="close"])',
          '.bloko-button_kind-success',
          '.bloko-button_kind-primary'
        ];
        
        for (const sel of submitSelectors) {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null) {
            result.hasSubmitButton = true;
            result.submitButtonSelectors.push({ selector: sel, text: btn.innerText });
          }
        }
        
        // Проверяем успех
        const text = document.body.innerText;
        result.hasSuccessMessage = text.includes('Отклик отправлен') || 
                                  text.includes('Вы откликнулись') ||
                                  text.includes('Резюме отправлено') ||
                                  text.includes('Ваш отклик отправлен');
        
        return result;
      });
      
      console.log("\n📋 Информация о модальном окне:");
      console.log(JSON.stringify(modalInfo, null, 2));
      
      // 11. Закрываем модальное окно
      console.log("\n🚪 Закрываем модальное окно...");
      await page.keyboard.press('Escape');
      await sleep(2000);
      await takeScreenshot(page, `06_after_close_${i + 1}`);
      
      console.log(`✅ Вакансия ${i + 1} проверена\n`);
    }
    
    console.log("\n✅ Тест модальных окон завершен!");
    
  } catch (error) {
    console.error("\n❌ ОШИБКА:", error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      try {
        // Не закрываем браузер, чтобы можно было посмотреть результат
        console.log("\nℹ️ Браузер оставлен открытым для проверки результата");
        console.log("ℹ️ Закрой его вручную когда закончишь");
      } catch (e) {}
    }
  }
}

debugModals();