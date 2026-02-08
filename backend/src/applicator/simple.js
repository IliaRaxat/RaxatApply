// applicator/simple.js - КЛИКАЕТ НА КНОПКУ ОТКЛИКНУТЬСЯ

import { updateVacancyStatus, blacklistVacancy, isVacancyBlacklisted } from '../db/database.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Сопроводительное письмо по умолчанию
const DEFAULT_COVER_LETTER = `Добрый день!

Меня заинтересовала ваша вакансия, так как мой опыт идеально ложится в задачи по развитию высоконагруженных фронтенд-систем.

Почему стоит обратить внимание на мой профиль:

• Масштабирование: В Альфа-Банке я успешно перевел платформу со 130k+ пользователей на стек Next.js (RSC), что позволило ускорить TTI с 4.5с до 1.2с без остановки бизнес-процессов.

• Сложный UI: Имею опыт разработки интерактивных модулей на чистом Canvas API и WebSockets (реализовал систему бронирования мест в реальном времени), где стандартные React-библиотеки не справлялись с нагрузкой.

• Бизнес-подход: Умею превращать размытые требования в четкую архитектуру, фокусируясь на производительности (Core Web Vitals) и быстрой доставке фич.

Готов оперативно созвониться, чтобы обсудить, как мой опыт работы в финтехе и со сложной графикой поможет вашей команде.`;

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

    // 1.5. ПРОВЕРЯЕМ - уже откликались на эту вакансию?
    const alreadyAppliedCheck = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      
      // Ищем конкретные фразы которые ТОЧНО означают что уже откликались
      const phrases = [
        'Вы откликнулись',
        'Отклик отправлен',
        'Резюме отправлено',
        'Вы уже откликались',
        'Вам отказали',
        'Вас пригласили',
        'Смотреть отклик',
        'Приглашение',
        'Отказ',
        'Отклик рассмотрен',
        'Отклик просмотрен',
        'Ваше резюме рассматривается',
        'Резюме на рассмотрении'
      ];
      
      for (const phrase of phrases) {
        if (text.includes(phrase)) {
          return { applied: true, reason: phrase };
        }
      }
      
      // Дополнительно проверяем элементы интерфейса
      const responseElements = document.querySelectorAll('[data-qa*="response"], [class*="response"], [data-qa*="отклик"]');
      for (const el of responseElements) {
        const elText = el.innerText || '';
        if (elText.includes('отправлен') || elText.includes('рассмотр') || elText.includes('пригласи') || elText.includes('отказ')) {
          return { applied: true, reason: `element: ${elText.substring(0, 50)}` };
        }
      }
      
      return { applied: false, reason: null };
    });
    
    if (alreadyAppliedCheck.applied) {
      console.log(`⏭️ УЖЕ ОТКЛИКАЛИСЬ: "${alreadyAppliedCheck.reason}" - пропускаем`);
      await updateVacancyStatus(vacancy.vacancy_id, 'already_applied');
      return { success: false, reason: 'already_applied' };
    }

    // 2. Ищем кнопку "Откликнуться"
    
    // Добавляем логирование для диагностики
    const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log(`🔍 Содержимое страницы (первые 500 символов): ${pageContent}`);
    
    // Ждем загрузки всех элементов
    await sleep(2000);
    
    const clickResult = await page.evaluate(() => {
      // Логируем все кнопки на странице для диагностики
      const allButtons = Array.from(document.querySelectorAll('button, a')).map(btn => ({
        text: btn.innerText?.trim(),
        className: btn.className,
        dataQa: btn.getAttribute('data-qa'),
        id: btn.id,
        href: btn.href
      })).filter(btn => btn.text && (btn.text.includes('Откликнуться') || btn.text.includes('Respond') || btn.dataQa?.includes('response')));
      
      console.log('Кнопки отклика на странице:', allButtons);
      
      // Приоритетные селекторы для кнопки "Откликнуться"
      const selectors = [
        '[data-qa="vacancy-response-link-top"]',
        '[data-qa="vacancy-response-link-bottom"]', 
        '[data-qa="vacancy-response-link"]',
        'a[data-qa*="vacancy-response"]',
        'button[data-qa*="vacancy-response"]',
        '[data-qa="vacancy__actions"] a',
        '[data-qa="vacancy__actions"] button',
        '.vacancy-actions a',
        '.vacancy-actions button',
        'a[data-qa*="response"]',
        'button[data-qa*="response"]',
        'a[data-qa*="respond"]',
        'button[data-qa*="respond"]'
      ];
      
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          btn.scrollIntoView({ block: 'center' });
          btn.click();
          return { clicked: true, selector: sel, text: btn.innerText?.trim() };
        }
      }
      
      // Ищем по тексту "Откликнуться" среди всех кликабельных элементов
      const allClickable = document.querySelectorAll('a, button, span[onclick], div[onclick]');
      for (const el of allClickable) {
        const text = (el.innerText || el.textContent || '').trim();
        if (text === 'Откликнуться' || text === 'Respond' || text === 'Отклик') {
          el.scrollIntoView({ block: 'center' });
          el.click();
          return { clicked: true, selector: 'text:' + text, text: text };
        }
      }
      
      return { clicked: false, selector: null, availableButtons: allButtons.length };
    });

    if (clickResult.clicked) {
      console.log(`✅ Кликнули: ${clickResult.selector} (текст: "${clickResult.text}")`);
    } else {
      console.log(`❌ Кнопка не найдена (доступно кнопок: ${clickResult.availableButtons})`);
      // Дополнительная диагностика - проверяем наличие других элементов
      const pageElements = await page.evaluate(() => {
        return {
          hasResponseButton: document.querySelector('[data-qa*="response"], [data-qa*="respond"], button') !== null,
          hasVacancyActions: document.querySelector('.vacancy-actions, [data-qa="vacancy__actions"]') !== null,
          pageUrl: window.location.href,
          allDataQaElements: Array.from(document.querySelectorAll('[data-qa]')).map(el => el.getAttribute('data-qa')).slice(0, 20)
        };
      });
      console.log(`Диагностика: ${JSON.stringify(pageElements)}`);
      await updateVacancyStatus(vacancy.vacancy_id, 'no_button');
      return { success: false, reason: 'no_button' };
    }

    // 3. Ждём реакции
    await sleep(1500);

    // 3.5. СНАЧАЛА проверяем и обрабатываем ВСЕ модалки (предупреждения, иностранные вакансии)
    const initialModalCheck = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return {
        hasRelocationWarning: text.includes('другой стран') || text.includes('another country') || 
                              text.includes('переезд') || text.includes('relocation') ||
                              document.querySelector('[data-qa="relocation-warning"]') !== null,
        hasForeignWarning: text.includes('иностранн') || text.includes('foreign') ||
                          text.includes('за рубеж') || text.includes('abroad'),
        hasAnyModal: document.querySelector('.bloko-modal, [class*="modal"], .popup') !== null
      };
    });
    
    if (initialModalCheck.hasRelocationWarning || initialModalCheck.hasForeignWarning) {
      console.log('⚠️ Предупреждение о релокации/иностранной вакансии - подтверждаем...');
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('.bloko-modal button, button');
        for (const btn of buttons) {
          const text = (btn.innerText || '').toLowerCase();
          if ((text.includes('подтвер') || text.includes('продолж') || text.includes('откликнуться') ||
               text.includes('confirm') || text.includes('continue') || text.includes('accept')) &&
              !text.includes('отмен') && !text.includes('cancel')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      await sleep(1500);
    }

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
      console.log('📝 Модалка с сопроводительным письмом...');
      
      // Получаем сопроводительное письмо
      const letterText = process.env.COVER_LETTER || DEFAULT_COVER_LETTER;
      console.log(`📝 Текст письма (первые 100 символов): ${letterText.substring(0, 100)}...`);
      
      // ШАГ 1: Заполняем поле письма через type (более надёжно чем value)
      const fieldFound = await page.evaluate(() => {
        const selectors = [
          '[data-qa="vacancy-response-letter-text"]',
          'textarea[name="letter"]',
          '[data-qa="vacancy-response-popup-form-letter-input"]',
          'textarea[data-qa*="letter"]',
          '.bloko-modal textarea',
          '.vacancy-response-popup textarea',
          'textarea'
        ];
        
        for (const sel of selectors) {
          const field = document.querySelector(sel);
          if (field && field.offsetParent !== null) {
            field.focus();
            field.value = ''; // Очищаем
            return { found: true, selector: sel };
          }
        }
        return { found: false };
      });
      
      if (fieldFound.found) {
        console.log(`✅ Поле найдено: ${fieldFound.selector}`);
        // Вводим текст через keyboard.type - это более надёжно
        await page.keyboard.type(letterText, { delay: 5 });
        console.log('✅ Письмо введено');
        await sleep(500);
      } else {
        console.log('❌ Поле для письма не найдено');
      }
      
      // ШАГ 2: Нажимаем кнопку отправки
      console.log('🔍 Ищем кнопку отправки...');
      await sleep(300);
      
      // Пробуем несколько раз
      for (let attempt = 0; attempt < 5; attempt++) {
        const submitResult = await page.evaluate(() => {
          // Ищем кнопку в модальном окне
          const modal = document.querySelector('.bloko-modal, .bloko-modal-window');
          const container = modal || document;
          
          // Приоритетные селекторы
          const selectors = [
            'button[data-qa="vacancy-response-letter-submit"]',
            'button[data-qa="vacancy-response-submit-popup"]',
            'button[data-qa="vacancy-response-submit"]',
            '[data-qa="vacancy-response-letter-submit"]',
            '[data-qa="vacancy-response-submit-popup"]',
          ];
          
          for (const sel of selectors) {
            const btn = container.querySelector(sel);
            if (btn && !btn.disabled) {
              btn.click();
              return { clicked: true, selector: sel };
            }
          }
          
          // Ищем по тексту кнопки в модалке
          const buttons = container.querySelectorAll('button');
          for (const btn of buttons) {
            const text = (btn.innerText || '').trim().toLowerCase();
            // Ищем кнопку "Откликнуться" или "Отправить"
            if ((text === 'откликнуться' || text === 'отправить' || text.includes('откликнуться')) && 
                !btn.disabled && btn.offsetParent !== null) {
              btn.click();
              return { clicked: true, selector: `text:${text}` };
            }
          }
          
          // Ищем любую primary кнопку в footer модалки
          const footerBtn = container.querySelector('.bloko-modal-footer button:not([data-qa*="cancel"])');
          if (footerBtn && !footerBtn.disabled) {
            footerBtn.click();
            return { clicked: true, selector: 'footer_button' };
          }
          
          return { clicked: false, buttonsFound: buttons.length };
        });
        
        if (submitResult.clicked) {
          console.log(`✅ Кнопка нажата (попытка ${attempt + 1}): ${submitResult.selector}`);
          await sleep(2000);
          
          // Проверяем успех
          const success = await checkSuccess(page);
          if (success) {
            console.log('✅ Отклик с письмом отправлен!');
            await updateVacancyStatus(vacancy.vacancy_id, 'applied');
            return { success: true };
          }
          break;
        } else {
          console.log(`⚠️ Попытка ${attempt + 1}: кнопка не найдена (кнопок на странице: ${submitResult.buttonsFound})`);
          await sleep(300);
        }
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
      console.log('⚠️ Обнаружено предупреждение о другой стране, подтверждаем...');
      
      // Несколько попыток подтвердить
      for (let attempt = 0; attempt < 3; attempt++) {
        const confirmResult = await page.evaluate(() => {
          // Ищем модальное окно
          const modal = document.querySelector('.bloko-modal, .bloko-modal-window, [class*="modal"], .popup');
          
          // Приоритетные селекторы для кнопки подтверждения
          const confirmSelectors = [
            '[data-qa="relocation-warning-confirm"]',
            '[data-qa="vacancy-response-submit-popup"]',
            '[data-qa*="confirm"]',
            '[data-qa*="accept"]',
            'button[data-qa*="submit"]',
          ];
          
          for (const sel of confirmSelectors) {
            const btn = document.querySelector(sel);
            if (btn && !btn.disabled && btn.offsetParent !== null) {
              btn.click();
              return { clicked: true, selector: sel };
            }
          }
          
          // Ищем по тексту в модальном окне
          const buttons = modal ? modal.querySelectorAll('button') : document.querySelectorAll('.bloko-modal button, button');
          for (const btn of buttons) {
            const text = (btn.innerText || '').toLowerCase();
            if ((text.includes('подтвер') || text.includes('продолж') || text.includes('confirm') || 
                 text.includes('accept') || text.includes('откликнуться') || text.includes('отправить')) && 
                !btn.disabled && btn.offsetParent !== null &&
                !text.includes('отмен') && !text.includes('cancel') && !text.includes('закрыть')) {
              btn.click();
              return { clicked: true, selector: 'text_confirm' };
            }
          }
          
          return { clicked: false };
        });
        
        if (confirmResult.clicked) {
          console.log(`✅ Подтвердили (попытка ${attempt + 1}): ${confirmResult.selector}`);
          await sleep(1500);
          break;
        } else {
          await sleep(300);
        }
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
      const successPhrases = [
        'Отклик отправлен',
        'Вы откликнулись',
        'Резюме отправлено',
        'Ваш отклик отправлен',
        'Отклик успешно отправлен',
        'Successfully sent',
        'Response sent',
        'Отклик создан',
        'Response created',
        'Заявка отправлена',
        'Application sent'
      ];
      
      // Проверяем текст на наличие фраз успеха
      for (const phrase of successPhrases) {
        if (text.includes(phrase)) {
          console.log(`Найдена фраза успеха: "${phrase}"`);
          return true;
        }
      }
      
      // Проверяем элементы интерфейса с сообщениями об успехе
      const successSelectors = [
        '[data-qa="vacancy-response-success-message"]',
        '[data-qa*="success"]',
        '[class*="success" i]',
        '.bloko-notification__content',
        '.bloko-notification',
        '.notification',
        '[data-qa="notification"]'
      ];
      
      for (const sel of successSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const elText = el.innerText || '';
          console.log(`Проверяем элемент ${sel}: "${elText}"`);
          if (elText.includes('отклик') || elText.includes('успешно') || elText.includes('отправлен') || 
              elText.includes('response') || elText.includes('success') || elText.includes('sent')) {
            console.log(`Элемент содержит сообщение об успехе`);
            return true;
          }
        }
      }
      
      // Проверяем изменение URL (иногда после успешного отклика происходит редирект)
      const currentUrl = window.location.href;
      if (currentUrl.includes('responses') || currentUrl.includes('отклик')) {
        console.log(`URL изменился на страницу откликов: ${currentUrl}`);
        return true;
      }
      
      console.log(`Результат проверки успешности: false`);
      return false;
    });
  } catch (e) {
    console.log(`Ошибка проверки успешности: ${e.message}`);
    return false;
  }
}