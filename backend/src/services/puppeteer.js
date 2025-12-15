// services/puppeteer.js

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config/index.js';

puppeteer.use(StealthPlugin());

export async function initializeBrowserAndPage(customConfig, cookies) {
  const browser = await puppeteer.launch({
    headless: customConfig.puppeteer.headless,
    slowMo: 0, // Убираем замедление для скорости
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-http-cache',
      '--disk-cache-size=0'
    ],
    defaultViewport: customConfig.puppeteer.defaultViewport || { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  await page.setViewport(customConfig.puppeteer.defaultViewport || { width: 1280, height: 800 });
  
  // Отключаем загрузку изображений для ускорения
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  await page.setCookie(...cookies);
  
  return { browser, page };
}

export async function clickElement(page, selector, timeout = 15000) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    await page.click(selector);
    
    if (config.delays?.afterClick) {
      await delay(config.delays.afterClick);
    }
    
    return true;
  } catch (error) {
    console.log(`Ошибка клика на "${selector}": ${error.message}`);
    
    if (error.message.includes('Execution context was destroyed')) {
      try {
        await delay(1000);
        await page.waitForSelector(selector, { visible: true, timeout });
        await page.click(selector);
        return true;
      } catch (retryError) {
        console.log(`Повторный клик не удался: ${retryError.message}`);
      }
    }
    
    return false;
  }
}

export async function typeText(page, target, text, delayValue = 0) {
  try {
    let element;
    if (typeof target === 'string') {
      element = await page.waitForSelector(target, { visible: true, timeout: 5000 });
    } else if (target && typeof target.type === 'function') {
      element = target;
    } else {
      throw new Error("Неверный тип target");
    }

    if (element) {
      const typingDelay = config.delays?.afterTyping || delayValue;
      await element.type(text, { delay: typingDelay });
      return true;
    }
    return false;
  } catch (error) {
    console.log(`Ошибка ввода текста: ${error.message}`);
    return false;
  }
}

export async function waitForResponseCompletion(page, finalSubmitButtonSelector = null) {
  console.log('🔍 Ожидание результата отклика...');
  
  const safeWaitForSelector = async (selector, options) => {
    try {
      return await page.waitForSelector(selector, options);
    } catch (error) {
      if (error.message.includes('Execution context was destroyed')) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          return await page.waitForSelector(selector, options);
        } catch (retryError) {
          return null;
        }
      }
      return null;
    }
  };
  
  const promises = [
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).then(() => 'navigation').catch(() => null),
    safeWaitForSelector('[data-qa="vacancy-response-success-message"]', { visible: true, timeout: 10000 }).then(() => 'success_message').catch(() => null),
    safeWaitForSelector('[data-qa="already-responded-text"]', { visible: true, timeout: 10000 }).then(() => 'already_responded').catch(() => null),
  ];

  if (finalSubmitButtonSelector) {
    promises.push(safeWaitForSelector(finalSubmitButtonSelector, { hidden: true, timeout: 10000 }).then(() => 'button_hidden').catch(() => null));
  }
  
  return await Promise.race(promises);
}

export async function delay(ms) {
  // Минимальная задержка 100 мс для стабильности
  const actualDelay = Math.max(ms, 100);
  return new Promise(resolve => setTimeout(resolve, actualDelay));
}
