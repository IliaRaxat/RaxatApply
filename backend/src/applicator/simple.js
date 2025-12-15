// applicator/simple.js - КЛИКАЕТ НА КНОПКУ ОТКЛИКНУТЬСЯ

import { updateVacancyStatus, blacklistVacancy, isVacancyBlacklisted } from '../db/database.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Сопроводительное письмо по умолчанию
const DEFAULT_COVER_LETTER = `Здравствуйте!

Меня заинтересовала ваша вакансия. Имею опыт работы с React, Next.js, TypeScript и современным frontend стеком.

Готов обсудить детали сотрудничества.

С уважением`;

export async function applyToVacancySimple(vacancy, browser, page) {
  console.log(`\n🚀 ${vacancy.title}`);
  
  if (!page || !vacancy.link) {
    console.log('❌ Нет page или link');
    return { success: false, reason: 'no_page' };
  }
  
  // Проверяем, что страница еще жива
  try {
    const pageTitle = await page.title();
    console.log(`Заголовок страницы: ${pageTitle}`);
  } catch (error) {
    console.log('❌ Страница недоступна');
    return { success: false, reason: 'page_unavailable' };
  }

  // Проверяем черный список
  try {
    const bl = await isVacancyBlacklisted(vacancy.vacancy_id);
    if (bl) {
      console.log('🚫 В черном списке');
      return { success: false, reason: 'blacklisted' };
    }
  } catch(e) {}

  try {
    // 1. Открываем вакансию
    console.log(`Открываем вакансию: ${vacancy.link}`);
    await page.goto(vacancy.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1000); // Уменьшаем время ожидания
    
    // Добавляем диагностику загрузки страницы
    const pageLoadInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasBodyContent: document.body && document.body.children.length > 0
      };
    });
    console.log(`Страница загружена: ${JSON.stringify(pageLoadInfo)}`);

    // 2. Ищем кнопку "Откликнуться"
    
    // Добавляем логирование для диагностики
    const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log(`🔍 Содержимое страницы (первые 500 символов): ${pageContent}`);
    
    const clickResult = await page.evaluate(() => {
      // Логируем все кнопки на странице для диагностики
      const allButtons = Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.innerText,
        className: btn.className,
        dataQa: btn.getAttribute('data-qa'),
        id: btn.id
      }));
      console.log('Все кнопки на странице:', allButtons.slice(0, 10)); // Первые 10 кнопок
      
      const selectors = [
        '[data-qa="vacancy-response-link-top"]',
        '[data-qa="vacancy-response-link-bottom"]',
        '[data-qa="vacancy-response-link"]',
        '[data-qa="vacancy__actions"] button',
        '.vacancy-actions button',
        'button[data-qa*="response"]',
        'button[data-qa*="respond"]',
        '[class*="response"] button',
        '[class*="respond"] button',
        'button[class*="response"], button[class*="respond"], button[class*="отклик"]'
      ];
      
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.scrollIntoView({ block: 'center' });
          btn.click();
          return { clicked: true, selector: sel };
        }
      }
      
      // Ищем по тексту "Откликнуться"
      const allElements = document.querySelectorAll('a, button, span');
      for (const el of allElements) {
        const text = (el.innerText || el.textContent || '').trim();
        if (text === 'Откликнуться' || text === 'Respond' || text.includes('Отклик') || text.includes('Respond')) {
          el.scrollIntoView({ block: 'center' });
          el.click();
          return { clicked: true, selector: 'text:Откликнуться' };
        }
      }
      
      // Дополнительные селекторы для новых элементов HH.ru
      const alternativeSelectors = [
        'button[data-qa*="response"]',
        'button[data-qa*="respond"]',
        '[class*="response"] button',
        '[class*="respond"] button'
      ];
      
      for (const sel of alternativeSelectors) {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.scrollIntoView({ block: 'center' });
          btn.click();
          return { clicked: true, selector: sel };
        }
      }
      
      return { clicked: false, selector: null };
    });

    if (clickResult.clicked) {
      console.log(`✅ Кликнули: ${clickResult.selector}`);
    } else {
      console.log('❌ Кнопка не найдена');
      // Дополнительная диагностика - проверяем наличие других элементов
      const pageElements = await page.evaluate(() => {
        return {
          hasResponseButton: document.querySelector('[data-qa*="response"], [data-qa*="respond"], button') !== null,
          hasVacancyActions: document.querySelector('.vacancy-actions, [data-qa="vacancy__actions"]') !== null,
          pageUrl: window.location.href
        };
      });
      console.log(`Диагностика: ${JSON.stringify(pageElements)}`);
      await updateVacancyStatus(vacancy.vacancy_id, 'no_button');
      return { success: false, reason: 'no_button' };
    }

    // 3. Ждём реакции
    await sleep(2000); // Увеличиваем время ожидания

    // 4. Проверяем опросник
    const hasQuiz = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return text.includes('Ответьте на вопрос') ||
             text.includes('вопрос от работодателя') ||
             text.includes('Вопросы работодателя') ||
             document.querySelector('[data-qa="vacancy-response-popup-form-question"]') !== null;
    });

    if (hasQuiz) {
      console.log('📝 Опросник - в черный список');
      try {
        await blacklistVacancy(vacancy.vacancy_id, 'quiz');
        await updateVacancyStatus(vacancy.vacancy_id, 'has_quiz');
      } catch(e) {}
      await page.keyboard.press('Escape');
      return { success: false, reason: 'has_quiz' };
    }

    // 5. Проверяем успех сразу после клика
    let isSuccess = await checkSuccess(page);
    if (isSuccess) {
      console.log('✅ Отклик отправлен!');
      await updateVacancyStatus(vacancy.vacancy_id, 'applied');
      return { success: true };
    }

    // 6. Проверяем модальное окно с обязательным сопроводительным
    const needsLetter = await page.evaluate(() => {
      // Ищем поле для сопроводительного письма
      const letterField = document.querySelector('[data-qa="vacancy-response-letter-text"]') ||
                          document.querySelector('textarea[name="letter"]') ||
                          document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]') ||
                          document.querySelector('textarea[data-qa*="letter"]') ||
                          document.querySelector('.vacancy-response-popup-form textarea') ||
                          document.querySelector('textarea[placeholder*="Сопроводительное"]') ||
                          document.querySelector('textarea[placeholder*="Cover"]');
      
      // Проверяем есть ли текст про обязательное письмо
      const text = document.body?.innerText || '';
      const isRequired = text.includes('Сопроводительное письмо обязательно') ||
                         text.includes('обязательно') ||
                         text.includes('Напишите сопроводительное') ||
                         document.querySelector('[data-qa*="required"]') !== null ||
                         (letterField && letterField.required);
      
      // Дополнительная диагностика
      const modalContent = document.querySelector('.bloko-modal, .popup, .vacancy-response-popup')?.innerText || '';
      
      return { 
        hasField: !!letterField, 
        isRequired,
        modalContent: modalContent.substring(0, 200) // Ограничиваем для логирования
      };
    });

    console.log(`Состояние модального окна: ${JSON.stringify(needsLetter)}`);

    if (needsLetter.hasField || needsLetter.isRequired) {
      console.log('📝 Нужно сопроводительное письмо...');
      
      // Вводим сопроводительное письмо
      const letterText = process.env.COVER_LETTER || DEFAULT_COVER_LETTER;
      
      await page.evaluate((text) => {
        const letterField = document.querySelector('[data-qa="vacancy-response-letter-text"]') ||
                            document.querySelector('textarea[name="letter"]') ||
                            document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]') ||
                            document.querySelector('textarea[data-qa*="letter"]') ||
                            document.querySelector('.vacancy-response-popup-form textarea') ||
                            document.querySelector('textarea[placeholder*="Сопроводительное"]') ||
                            document.querySelector('textarea[placeholder*="Cover"]') ||
                            document.querySelector('textarea');
        
        console.log(`Поле для письма найдено: ${!!letterField}`);
        if (letterField) {
          console.log(`Заполняем поле письма: ${text.substring(0, 100)}...`);
          letterField.value = text;
          letterField.dispatchEvent(new Event('input', { bubbles: true }));
          letterField.dispatchEvent(new Event('change', { bubbles: true }));
          
          // Дополнительно проверяем значение
          console.log(`Значение поля после заполнения: ${letterField.value.substring(0, 100)}...`);
        } else {
          console.log('Поле для сопроводительного письма не найдено');
          
          // Пытаемся найти любое текстовое поле в модальном окне
          const textAreas = Array.from(document.querySelectorAll('textarea'));
          console.log(`Найдено текстовых полей: ${textAreas.length}`);
          if (textAreas.length > 0) {
            const firstTextArea = textAreas[0];
            console.log(`Заполняем первое текстовое поле`);
            firstTextArea.value = text;
            firstTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            firstTextArea.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, letterText);
      
      console.log('✅ Письмо введено');
      await sleep(1000);
      
      // После заполнения письма ищем и нажимаем кнопку отправки
      console.log('🔍 Ищем кнопку отправки после заполнения письма...');
      const letterSubmitResult = await page.evaluate(() => {
        // Ждем немного, чтобы форма обработалась
        const selectors = [
          'button[data-qa="vacancy-response-letter-submit"]',
          'button[data-qa="vacancy-response-submit-popup"]',
          'button[type="submit"]',
          '.bloko-modal-footer button:not([data-qa*="cancel"]):not([data-qa*="close"])',
          'button[class*="send"], button[class*="submit"], button[class*="отправить"]',
          '.bloko-button_kind-success',
          '.bloko-button_kind-primary',
          // Дополнительные селекторы для модальных окон с письмами
          '[data-qa="vacancy-response-form"] button[type="submit"]',
          '.vacancy-response-popup-form button[type="submit"]',
          '.bloko-modal-footer .bloko-button',
          '.popup-actions button'
        ];
        
        // Сначала ищем активную кнопку отправки
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null) {
            // Дополнительно проверяем, что кнопка не отключена
            if (!btn.disabled && !btn.hasAttribute('disabled')) {
              btn.click();
              return { clicked: true, selector: sel };
            }
          }
        }
        
        // Если не нашли, пробуем найти любую кнопку "Отправить" в модальном окне
        const allButtons = Array.from(document.querySelectorAll('.bloko-modal button, .popup button'));
        for (const btn of allButtons) {
          const text = (btn.innerText || btn.textContent || '').toLowerCase();
          if ((text.includes('отправить') || text.includes('send') || text.includes('submit')) && 
              !btn.disabled && !btn.hasAttribute('disabled') && 
              btn.offsetParent !== null) {
            btn.click();
            return { clicked: true, selector: 'generic_send_button' };
          }
        }
        
        return { clicked: false };
      });
      
      if (letterSubmitResult.clicked) {
        console.log(`✅ Нажали отправить после заполнения письма: ${letterSubmitResult.selector}`);
        await sleep(3000); // Увеличиваем время ожидания после отправки
      } else {
        console.log('❌ Не удалось найти кнопку отправки после заполнения письма');
        // Пробуем закрыть модальное окно и продолжить
        await page.keyboard.press('Escape');
      }
    }

    // 7. Ищем и кликаем кнопку отправки
    console.log('🔍 Ищем кнопку отправки...');
    
    // Сначала проверим наличие модальных окон и обработаем их
    const modalCheck = await page.evaluate(() => {
      // Проверяем наличие модального окна с предупреждением о другой стране
      const relocationWarning = document.querySelector('[data-qa="relocation-warning"]') ||
                              document.querySelector('[class*="relocation" i]') ||
                              document.body.innerText.includes('другой стран') ||
                              document.body.innerText.includes('another country') ||
                              document.body.innerText.includes('переезд') ||
                              document.body.innerText.includes('relocation') ||
                              document.querySelector('[data-qa*="warning"]') !== null;
      
      // Проверяем наличие модального окна с обязательным сопроводительным письмом
      const letterRequired = document.querySelector('[data-qa="vacancy-response-letter"]') ||
                           document.body.innerText.includes('Сопроводительное письмо обязательно') ||
                           document.body.innerText.includes('обязательно');
      
      // Проверяем наличие модального окна для международных вакансий
      const internationalVacancy = document.body.innerText.includes('international') ||
                                  document.body.innerText.includes('гност') ||
                                  document.querySelector('[data-qa*="international"]') !== null ||
                                  document.querySelector('[data-qa*="foreign"]') !== null;
      
      return {
        hasRelocationWarning: !!relocationWarning,
        hasLetterRequired: !!letterRequired,
        hasInternationalModal: !!internationalVacancy,
        modalContent: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log(`Состояние модальных окон: ${JSON.stringify(modalCheck)}`);
    
    // Если есть предупреждение о другой стране или международная вакансия, подтверждаем
    if (modalCheck.hasRelocationWarning || modalCheck.hasInternationalModal) {
      console.log('⚠️ Обнаружено предупреждение о другой стране или международная вакансия, подтверждаем...');
      const confirmResult = await page.evaluate(() => {
        const confirmSelectors = [
          '[data-qa="relocation-warning-confirm"]',
          '[data-qa*="confirm"]',
          '[data-qa*="accept"]',
          'button[class*="confirm"], button[class*="continue"], button[class*="далее"], button[class*="принять"], button[class*="accept"]',
          'button:contains("Подтверждаю"), button:contains("Продолжить"), button:contains("Confirm"), button:contains("Принимаю"), button:contains("Accept")',
          '.bloko-button_kind-primary',
          'button[type="button"]:not([data-qa*="cancel"]):not([data-qa*="close"])'
        ];
        
        for (const sel of confirmSelectors) {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return { clicked: true, selector: sel };
          }
        }
        return { clicked: false };
      });
      
      if (confirmResult.clicked) {
        console.log(`✅ Подтвердили действие: ${confirmResult.selector}`);
        await sleep(1500); // Уменьшаем время ожидания после подтверждения для ускорения
      }
    }
    
    const submitResult = await page.evaluate(() => {
      const selectors = [
        'button[data-qa="vacancy-response-submit-popup"]',
        'button[data-qa="vacancy-response-letter-submit"]',
        'button[data-qa="relocation-warning-confirm"]',
        'button[type="submit"]',
        'button[data-qa="vacancy-response-popup-close"]',
        '.bloko-modal-footer button:not([data-qa*="cancel"]):not([data-qa*="close"])',
        'button[class*="send"], button[class*="submit"], button[class*="отправить"]',
        '.bloko-button_kind-success',
        '.bloko-button_kind-primary',
        'button:contains("Отправить"), button:contains("Send"), button:contains("Подтвердить"), button:contains("Accept")'
      ];
      
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          // Дополнительно проверяем, что кнопка не отключена
          if (!btn.disabled && !btn.hasAttribute('disabled')) {
            btn.click();
            return { clicked: true, selector: sel };
          }
        }
      }
      return { clicked: false };
    });

    if (submitResult.clicked) {
      console.log(`✅ Нажали отправить: ${submitResult.selector}`);
      await sleep(1500); // Уменьшаем время ожидания для ускорения
      
      // Добавляем диагностику после отправки формы
      const postSubmitState = await page.evaluate(() => {
        return {
          pageTextPreview: document.body.innerText.substring(0, 200),
          hasSuccessMessage: document.querySelector('[data-qa*="success"], .success, [class*="success"]') !== null,
          hasErrorMessage: document.querySelector('[data-qa*="error"], .error, [class*="error"]') !== null
        };
      });
      console.log(`Состояние после отправки: ${JSON.stringify(postSubmitState)}`);
    }

    // 8. ФИНАЛЬНАЯ ПРОВЕРКА - отклик реально отправлен?
    isSuccess = await checkSuccess(page);
    
    if (isSuccess) {
      console.log('✅ Отклик отправлен!');
      await updateVacancyStatus(vacancy.vacancy_id, 'applied');
      return { success: true };
    } else {
      console.log('❌ Отклик НЕ отправлен');
      await updateVacancyStatus(vacancy.vacancy_id, 'failed');
      
      // Добавляем дополнительную диагностику перед закрытием модального окна
      const preCloseState = await page.evaluate(() => {
        return {
          pageTextPreview: document.body.innerText.substring(0, 200),
          modalVisible: document.querySelector('.bloko-modal, [class*="modal"], .popup') !== null,
          notifications: Array.from(document.querySelectorAll('.bloko-notification, .notification'))
            .map(el => el.innerText.substring(0, 100))
        };
      });
      console.log(`Состояние перед закрытием: ${JSON.stringify(preCloseState)}`);
      
      // Только если модальное окно видимо, закрываем его
      if (preCloseState.modalVisible) {
        await page.keyboard.press('Escape');
      }
      return { success: false, reason: 'not_sent' };
    }

  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
    console.log(`_STACK_: ${error.stack}`);
    
    // Сетевые ошибки - пробуем пересоздать страницу
    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED') || 
        error.message.includes('net::ERR_CONNECTION_RESET') || 
        error.message.includes('net::ERR_NETWORK_CHANGED') ||
        error.message.includes('Timeout') ||
        error.message.includes('net::ERR_CONNECTION_TIMED_OUT')) {
      console.log('📡 Сетевая ошибка, пробуем пересоздать страницу...');
      try { await updateVacancyStatus(vacancy.vacancy_id, 'network_error'); } catch(e) {}
      return { success: false, reason: 'network_error' };
    }
    
    // Ошибки контекста - проверяем URL
    if (error.message.includes('context') || 
        error.message.includes('Target') ||
        error.message.includes('Protocol') ||
        error.message.includes('detached') ||
        error.message.includes('Execution context')) {
      // Не считаем автоматически успехом - это ошибка
      console.log('❌ Страница сломалась');
      try { await updateVacancyStatus(vacancy.vacancy_id, 'page_crashed'); } catch(e) {}
      return { success: false, reason: 'page_crashed' };
    }
    
    try { await updateVacancyStatus(vacancy.vacancy_id, 'error'); } catch(e) {}
    return { success: false, reason: error.message };
  }
}

// Проверка успешной отправки отклика
async function checkSuccess(page) {
  try {
    return await page.evaluate(() => {
      const text = document.body?.innerText || '';
      console.log(`Проверка успешности: текст страницы содержит - ${text.substring(0, 300)}`);
      
      // Проверяем различные варианты сообщений об успехе
      const isSuccess = text.includes('Отклик отправлен') || 
             text.includes('Вы откликнулись') ||
             text.includes('Резюме отправлено') ||
             text.includes('Ваш отклик отправлен') ||
             text.includes('Отклик успешно отправлен') ||
             text.includes('Successfully sent') ||
             text.includes('успешно') ||
             text.includes('Success') ||
             text.includes('отправлен') ||
             text.includes('принят') ||
             text.includes('Отклик создан') ||
             text.includes('created') ||
             document.querySelector('[data-qa="vacancy-response-success-message"]') !== null ||
             document.querySelector('[class*="success" i]') !== null ||
             document.querySelector('[data-qa*="success"]') !== null ||
             document.querySelector('.bloko-notification__content')?.innerText?.includes('отклик') ||
             document.querySelector('.bloko-notification__content')?.innerText?.includes('успешно') ||
             document.querySelector('.bloko-notification')?.innerText?.includes('отклик') ||
             document.querySelector('.notification')?.innerText?.includes('отклик');
             
      console.log(`Результат проверки успешности: ${isSuccess}`);
      return isSuccess;
    });
  } catch (e) {
    return false;
  }
}