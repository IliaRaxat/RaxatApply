// applicator/simple.js - УПРОЩЕННАЯ версия отправки откликов

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

import { config } from '../config/index.js';
import { updateVacancyStatus } from '../db/database.js';

/**
 * ПРОСТАЯ отправка отклика - БЕЗ сопроводительного письма, БЕЗ опросника
 */
export async function applyToVacancySimple(vacancy, sharedBrowser = null, sharedPage = null, resumeConfig = null) {
  let browser = sharedBrowser;
  let page = sharedPage;
  let shouldCloseBrowser = false;
  
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 ОТКЛИК: ${vacancy.title}`);
    console.log(`🏢 ${vacancy.company}`);
    console.log(`${'='.repeat(80)}`);

    if (!browser || !page) {
      console.log('🌐 Открываем браузер...');
      browser = await puppeteer.launch({
        headless: config.puppeteer.headless,
        slowMo: config.puppeteer.slowMo || 200,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1920, height: 1080 }
      });
      
      page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      shouldCloseBrowser = true;
    }

    // Шаг 1: Открываем страницу вакансии
    console.log('\n📄 Шаг 1: Открываем страницу вакансии...');
    await page.goto(vacancy.link, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2000);
    
    // Проверяем капчу
    const hasCaptcha = await page.$('iframe[src*="captcha"]');
    if (hasCaptcha) {
      console.log('🤖 КАПЧА! Реши её вручную в браузере...');
      await waitForCaptcha(page);
    }

    // Шаг 2: Проверка что НЕ откликнулись
    console.log('\n🔍 Шаг 2: Проверяем статус отклика...');
    const alreadyResponded = await page.evaluate(() => {
      const text = document.body.innerText || '';
      return text.includes('Вы откликнулись') || 
             text.includes('Отклик отправлен') ||
             text.includes('Резюме отправлено') ||
             text.includes('Не просмотрен') ||
             text.includes('Просмотрен') ||
             text.includes('Приглашение') ||
             text.includes('Отказ') ||
             text.includes('Ваш отклик');
    });
    
    if (alreadyResponded) {
      console.log('⚠️ УЖЕ ОТКЛИКНУЛИСЬ - ПРОПУСКАЕМ');
      await updateVacancyStatus(vacancy.vacancy_id, 'already_responded');
      return { success: false, reason: 'already_responded' };
    }
    
    const hasResponseButton = await page.$('[data-qa="vacancy-response-link-top"]');
    if (!hasResponseButton) {
      console.log('⚠️ НЕТ кнопки "Откликнуться" - ПРОПУСКАЕМ');
      await updateVacancyStatus(vacancy.vacancy_id, 'already_responded');
      return { success: false, reason: 'no_response_button' };
    }
    
    console.log('✅ Отклика нет, кнопка есть, продолжаем...');

    // Шаг 3: Ищем кнопку "Откликнуться"
    console.log('\n🔘 Шаг 3: Ищем кнопку "Откликнуться"...');
    
    const responseButton = await page.$('[data-qa="vacancy-response-link-top"]');
    
    if (responseButton) {
      console.log('✅ Найдена кнопка отклика');
      console.log('👆 Кликаем...');
      
      await responseButton.click();
      await delay(3000);
      
      console.log('\n📋 Шаг 4: Проверяем форму отклика...');
      
      const submitButton = await page.$('button[data-qa="vacancy-response-submit-popup"]');
      
      if (submitButton) {
        console.log('✅ Найдена кнопка "Отправить"');
        console.log('👆 Кликаем...');
        
        await submitButton.click();
        await delay(3000);
        
        const success = await page.evaluate(() => {
          const text = document.body.innerText || '';
          return text.includes('Отклик отправлен') || 
                 text.includes('успешно') ||
                 text.includes('Вы откликнулись');
        });
        
        if (success) {
          console.log('\n✅ УСПЕХ! Отклик отправлен!');
          await updateVacancyStatus(vacancy.vacancy_id, 'applied');
          return { success: true };
        } else {
          await updateVacancyStatus(vacancy.vacancy_id, 'applied');
          return { success: true };
        }
      } else {
        console.log('⚠️ Не найдена кнопка "Отправить"');
        
        await delay(2000);
        const successAfterClick = await page.evaluate(() => {
          const text = document.body.innerText || '';
          return text.includes('Отклик отправлен') || text.includes('Вы откликнулись');
        });
        
        if (successAfterClick) {
          console.log('✅ Отклик отправлен!');
          await updateVacancyStatus(vacancy.vacancy_id, 'applied');
          return { success: true };
        } else {
          console.log('❌ Не удалось отправить отклик');
          await updateVacancyStatus(vacancy.vacancy_id, 'failed_application');
          return { success: false, reason: 'submit_button_not_found' };
        }
      }
    } else {
      console.log('❌ Не найдена кнопка отклика');
      await updateVacancyStatus(vacancy.vacancy_id, 'no_response_button');
      return { success: false, reason: 'no_response_button' };
    }

  } catch (error) {
    console.error(`\n❌ ОШИБКА: ${error.message}`);
    
    if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
      console.log('✅ Отклик скорее всего отправлен');
      await updateVacancyStatus(vacancy.vacancy_id, 'applied');
      return { success: true };
    }
    
    await updateVacancyStatus(vacancy.vacancy_id, 'error_during_application');
    return { success: false, reason: error.message };
    
  } finally {
    if (shouldCloseBrowser && browser) {
      await delay(1000);
      await browser.close();
    }
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForCaptcha(page, maxWaitMinutes = 2) {
  const maxAttempts = maxWaitMinutes * 12;
  
  for (let i = 0; i < maxAttempts; i++) {
    const hasCaptcha = await page.$('iframe[src*="captcha"]');
    if (!hasCaptcha) {
      console.log('✅ Капча решена!');
      return;
    }
    
    const timeLeft = Math.round((maxAttempts - i) * 5 / 60);
    console.log(`⏳ Жду решения капчи... (осталось ~${timeLeft} мин)`);
    await delay(5000);
  }
  
  throw new Error('Капча не решена за отведенное время');
}
