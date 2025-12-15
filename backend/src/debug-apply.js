#!/usr/bin/env node
// debug-apply.js - Скрипт для отладки откликов

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

async function debugApply() {
  console.log("=== ДЕБАГ ОТКЛИКА НА HH.RU ===\n");
  
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
                    document.querySelector('[class*="bloko-modal"]') ||
                    document.querySelector('.vacancy-response-popup');
      
      if (popup) {
        result.hasPopup = true;
        result.popupContent = popup.innerText.substring(0, 300);
      }
      
      // Проверяем успех
      const text = document.body.innerText;
      result.hasSuccessMessage = text.includes('Отклик отправлен') || 
                                text.includes('Вы откликнулись') ||
                                text.includes('Резюме отправлено') ||
                                text.includes('Ваш отклик отправлен');
      
      return result;
    });
    
    console.log("\n📋 После клика:");
    console.log(`- Popup: ${afterClickInfo.hasPopup ? 'ДА' : 'НЕТ'}`);
    console.log(`- Успех: ${afterClickInfo.hasSuccessMessage ? 'ДА' : 'НЕТ'}`);
    console.log(`- Текст: ${afterClickInfo.pageText}`);
    
    if (afterClickInfo.popupContent) {
      console.log(`- Содержимое popup: ${afterClickInfo.popupContent}`);
    }
    
    // 11. Если есть popup, пробуем заполнить сопроводительное письмо
    if (afterClickInfo.hasPopup) {
      console.log("\n📝 Проверяем необходимость сопроводительного письма...");
      
      const letterInfo = await page.evaluate(() => {
        // Ищем поле для сопроводительного письма
        const letterField = document.querySelector('[data-qa="vacancy-response-letter-text"]') ||
                            document.querySelector('textarea[name="letter"]') ||
                            document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]') ||
                            document.querySelector('textarea[data-qa*="letter"]') ||
                            document.querySelector('.vacancy-response-popup-form textarea');
        
        return {
          hasLetterField: !!letterField,
          letterFieldSelector: letterField ? 'found' : null,
          pageTextPreview: document.body.innerText.substring(0, 500)
        };
      });
      
      console.log(`Поле для письма: ${letterInfo.hasLetterField ? 'ДА' : 'НЕТ'}`);
      
      if (letterInfo.hasLetterField) {
        console.log("✏️ Заполняем сопроводительное письмо...");
        
        const letterText = `Здравствуйте!

Меня заинтересовала ваша вакансия. Имею опыт работы с React, Next.js, TypeScript и современным frontend стеком.

Готов обсудить детали сотрудничества.

С уважением`;
        
        await page.evaluate((text) => {
          const letterField = document.querySelector('[data-qa="vacancy-response-letter-text"]') ||
                              document.querySelector('textarea[name="letter"]') ||
                              document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]') ||
                              document.querySelector('textarea[data-qa*="letter"]') ||
                              document.querySelector('.vacancy-response-popup-form textarea');
          
          if (letterField) {
            letterField.value = text;
            letterField.dispatchEvent(new Event('input', { bubbles: true }));
            letterField.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, letterText);
        
        console.log("✅ Письмо заполнено");
        await sleep(1000);
      }
      
      // 12. Ищем кнопку отправки
      console.log("\n🔍 Ищем кнопку отправки...");
      
      const submitResult = await page.evaluate(() => {
        const selectors = [
          'button[data-qa="vacancy-response-submit-popup"]',
          'button[data-qa="vacancy-response-letter-submit"]',
          'button[data-qa="relocation-warning-confirm"]',
          'button[type="submit"]',
          'button[data-qa="vacancy-response-popup-close"]',
          '.bloko-modal-footer button'
        ];
        
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null) {
            return { found: true, selector: sel, text: btn.innerText };
          }
        }
        return { found: false };
      });
      
      if (submitResult.found) {
        console.log(`✅ Найдена кнопка отправки: ${submitResult.selector} (${submitResult.text})`);
        
        // Кликаем на кнопку отправки
        await page.evaluate((selector) => {
          const btn = document.querySelector(selector);
          if (btn) {
            btn.click();
          }
        }, submitResult.selector);
        
        console.log("✅ Кнопка отправки нажата, ждём 5 секунд...");
        await sleep(5000);
        await takeScreenshot(page, '06_after_submit');
        
        // Проверяем результат
        const finalResult = await page.evaluate(() => {
          const text = document.body.innerText;
          return {
            success: text.includes('Отклик отправлен') || 
                     text.includes('Вы откликнулись') ||
                     text.includes('Резюме отправлено') ||
                     text.includes('Ваш отклик отправлен'),
            pageText: text.substring(0, 500)
          };
        });
        
        console.log(`\n🏁 Финальный результат:`);
        console.log(`- Успех: ${finalResult.success ? 'ДА' : 'НЕТ'}`);
        console.log(`- Текст: ${finalResult.pageText}`);
      } else {
        console.log("❌ Кнопка отправки не найдена");
      }
    }
    
    console.log("\n✅ Тест завершен!");
    
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

debugApply();