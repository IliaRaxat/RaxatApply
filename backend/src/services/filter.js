// services/filter.js

import { config } from '../config/index.js';

/**
 * Проверяет, соответствует ли вакансия фильтрам
 * БОЛЕЕ ЛОЯЛЬНАЯ фильтрация - разрешаем больше вакансий
 */
export function isVacancySuitable(vacancy) {
  // Восстанавливаем нормальную фильтрацию
  const { stopWords } = config.filters;
  
  const titleLower = (vacancy.title || '').toLowerCase();
  const fullText = [
    vacancy.title || '',
    vacancy.company || '',
    vacancy.description_text || ''
  ].join(' ').toLowerCase();
  
  // СТОП-СЛОВА - отсеиваем только явно нерелевантные
  if (stopWords && stopWords.length > 0) {
    for (const stopWord of stopWords) {
      // Проверяем только в заголовке для более строгой фильтрации
      if (titleLower.includes(stopWord.toLowerCase())) {
        return false;
      }
    }
  }
  
  // ЖЁСТКАЯ ПРОВЕРКА НАЗВАНИЯ
  // Если в названии Angular или Vue - отсеиваем
  if (/\bangular\b/i.test(titleLower)) return false;
  if (/\bvue\.?js\b/i.test(titleLower)) return false;
  if (/\bsvelte\b/i.test(titleLower)) return false;
  
  // Если в названии backend языки - отсеиваем
  if (/\b(php|java(?!script)|c#|\.net|python|golang|ruby|django|laravel)\b/i.test(titleLower)) return false;
  
  // Если в названии mobile - отсеиваем
  if (/\b(ios|android|flutter|swift|kotlin|mobile)\b/i.test(titleLower)) return false;
  
  // Если явно указано "backend" в заголовке - отсеиваем
  if (/\b(backend|бэкенд|бекенд|back-end)\b/i.test(titleLower)) return false;
  
  // Если явно указано DevOps/QA/Analyst/Support/Manager в заголовке - отсеиваем
  if (/\b(devops|qa|qc|тестировщик|тестирование|аналитик|analyst|sre|support|поддержк|менеджер|manager|hr|recruiter|рекрутер|product owner|po\b|pm\b|project manager|scrum master|data scientist|data engineer|ml engineer|machine learning|dba|администратор|sysadmin|системный администратор)\b/i.test(titleLower)) return false;
  
  return true;
}

/**
 * Вычисляет релевантность вакансии для React/Next.js Frontend разработчика
 * 
 * ПРИОРИТЕТ РЕЛЕВАНТНОСТИ:
 * 1. Frontend Next.js - 100000+ баллов
 * 2. Frontend React - 80000+ баллов
 * 3. Frontend (без React/Next) - 50000+ баллов
 * 4. TypeScript - 30000+ баллов
 * 5. JavaScript - 15000+ баллов
 * 6. Fullstack - 5000+ баллов
 * 
 * ЦЕЛЬ: Найти 350-400 релевантных вакансий для каждого резюме
 */
export function calculateVacancyRelevance(vacancy) {
  const fullText = [
    vacancy.title || '', 
    vacancy.company || '', 
    vacancy.description_text || ''
  ].join(' ').toLowerCase();
  
  const titleText = (vacancy.title || '').toLowerCase();

  // ============================================
  // ПРОВЕРЯЕМ СТОП-ФАКТОРЫ
  // Даём очень низкий score вместо 0, чтобы вакансии были в конце списка
  // ============================================
  
  let penalty = 0;
  
  // Angular/Vue/Svelte в НАЗВАНИИ = низкий приоритет
  if (/\bangular\b/i.test(titleText)) penalty += 50000;
  if (/\bvue\.?js\b/i.test(titleText)) penalty += 50000;
  if (/\bsvelte\b/i.test(titleText)) penalty += 50000;
  
  // Backend языки в НАЗВАНИИ = низкий приоритет (java но не javascript)
  if (/\b(php|java(?!script)|c#|\.net|python|golang|ruby|django|laravel|spring)\b/i.test(titleText)) penalty += 80000;
  
  // Mobile в НАЗВАНИИ = низкий приоритет
  if (/\b(ios|android|flutter|swift|kotlin|mobile|мобильн)\b/i.test(titleText)) penalty += 80000;
  
  // Backend в НАЗВАНИИ = низкий приоритет
  if (/\b(backend|бэкенд|бекенд|back-end)\b/i.test(titleText)) penalty += 70000;
  
  // DevOps/QA/Analyst = очень низкий приоритет (но не 0!)
  if (/\b(devops|qa|qc|тестировщик|тестирование|аналитик|analyst|sre)\b/i.test(titleText)) penalty += 90000;
  
  // HR/Manager/Support = самый низкий приоритет
  if (/\b(support|поддержк|менеджер|manager|hr|recruiter|рекрутер|product owner|pm\b|project manager|scrum master|data scientist|data engineer|ml engineer|machine learning|dba|администратор|sysadmin|системный администратор)\b/i.test(titleText)) penalty += 95000;

  // ============================================
  // ОПРЕДЕЛЯЕМ КАТЕГОРИЮ ВАКАНСИИ
  // ============================================
  
  const titleHasNext = /next\.?js|nextjs/i.test(titleText);
  const titleHasReact = /\breact\b/i.test(titleText);
  const titleHasFrontend = /frontend|фронтенд|front-end|фронт-энд|фронт энд/i.test(titleText);
  const titleHasTS = /typescript|ts/i.test(titleText);
  const titleHasJS = /javascript|js\b/i.test(titleText);
  const titleHasFullstack = /fullstack|full-stack|full stack|фулстек|фуллстек|фулл-стек/i.test(titleText);
  
  let score = 0;
  let category = 'other';

  // ============================================
  // КАТЕГОРИЯ 1: Frontend Next.js (100000+ баллов)
  // ============================================
  if (titleHasNext && (titleHasFrontend || titleHasReact)) {
    category = 'frontend_nextjs';
    score = 100000;
    
    // Бонусы внутри категории
    if (titleHasReact) score += 5000;
    if (titleHasTS) score += 3000;
    if (titleHasFrontend) score += 2000;
  }
  // Next.js без явного Frontend/React
  else if (titleHasNext) {
    category = 'frontend_nextjs';
    score = 95000;
    
    if (titleHasTS) score += 3000;
  }
  
  // ============================================
  // КАТЕГОРИЯ 2: Frontend React (80000+ баллов)
  // ============================================
  else if (titleHasReact && titleHasFrontend) {
    category = 'frontend_react';
    score = 85000;
    
    if (titleHasTS) score += 5000;
    if (/next\.?js/i.test(fullText)) score += 3000; // Next в описании
  }
  // React без явного Frontend
  else if (titleHasReact) {
    category = 'frontend_react';
    score = 80000;
    
    if (titleHasTS) score += 5000;
    if (/next\.?js/i.test(fullText)) score += 3000;
    if (titleHasFrontend) score += 2000;
  }
  
  // ============================================
  // КАТЕГОРИЯ 3: Frontend (без React/Next) (50000+ баллов)
  // ============================================
  else if (titleHasFrontend) {
    category = 'frontend';
    score = 50000;
    
    // Бонусы за технологии в описании
    if (/\breact\b/i.test(fullText)) score += 10000;
    if (/next\.?js/i.test(fullText)) score += 8000;
    if (titleHasTS) score += 5000;
    if (titleHasJS) score += 2000;
  }
  
  // ============================================
  // КАТЕГОРИЯ 4: TypeScript (30000+ баллов)
  // ============================================
  else if (titleHasTS) {
    category = 'typescript';
    score = 30000;
    
    // Бонусы за frontend технологии в описании
    if (/\breact\b/i.test(fullText)) score += 10000;
    if (/next\.?js/i.test(fullText)) score += 8000;
    if (/frontend|фронтенд/i.test(fullText)) score += 5000;
  }
  
  // ============================================
  // КАТЕГОРИЯ 5: JavaScript (15000+ баллов)
  // ============================================
  else if (titleHasJS) {
    category = 'javascript';
    score = 15000;
    
    // Бонусы за frontend технологии в описании
    if (/\breact\b/i.test(fullText)) score += 8000;
    if (/next\.?js/i.test(fullText)) score += 6000;
    if (/frontend|фронтенд/i.test(fullText)) score += 4000;
    if (/typescript/i.test(fullText)) score += 3000;
  }
  
  // ============================================
  // КАТЕГОРИЯ 6: Fullstack (5000+ баллов)
  // ============================================
  else if (titleHasFullstack) {
    category = 'fullstack';
    score = 5000;
    
    // Бонусы за frontend технологии
    if (/\breact\b/i.test(fullText)) score += 5000;
    if (/next\.?js/i.test(fullText)) score += 4000;
    if (/typescript/i.test(fullText)) score += 2000;
    if (/frontend|фронтенд/i.test(fullText)) score += 2000;
  }
  
  // ============================================
  // КАТЕГОРИЯ 7: Прочее (проверяем описание)
  // ============================================
  else {
    // Проверяем есть ли React/Next/Frontend в описании
    if (/\breact\b/i.test(fullText)) {
      score = 3000;
    } else if (/next\.?js/i.test(fullText)) {
      score = 2500;
    } else if (/frontend|фронтенд/i.test(fullText)) {
      score = 2000;
    } else if (/typescript/i.test(fullText)) {
      score = 1000;
    } else if (/javascript/i.test(fullText)) {
      score = 500;
    } else {
      // Совсем нерелевантная вакансия
      return 0;
    }
  }

  // ============================================
  // БОНУСЫ ЗА УРОВЕНЬ ПОЗИЦИИ
  // ============================================
  
  if (/senior|синьор|сеньор|ведущий|lead|лид/i.test(titleText)) {
    score += 1500;
  } else if (/middle|мидл|миддл/i.test(titleText)) {
    score += 1000;
  } else if (/junior|джуниор|джун/i.test(titleText)) {
    score += 500;
  }

  // ============================================
  // БОНУСЫ ЗА ДОПОЛНИТЕЛЬНЫЕ ТЕХНОЛОГИИ
  // ============================================
  
  if (/redux|mobx|zustand/i.test(fullText)) score += 500;
  if (/webpack|vite|rollup/i.test(fullText)) score += 300;
  if (/jest|testing|cypress|playwright/i.test(fullText)) score += 300;
  if (/graphql/i.test(fullText)) score += 300;
  if (/tailwind|styled-components|emotion/i.test(fullText)) score += 200;
  if (/node\.?js/i.test(fullText)) score += 200;
  if (/docker/i.test(fullText)) score += 100;

  // ============================================
  // ШТРАФЫ ЗА НЕРЕЛЕВАНТНОЕ В ОПИСАНИИ
  // ============================================
  
  // Vue/Angular в описании - штраф
  if (/\bvue\b/i.test(fullText)) score -= 500; // Уменьшаем штраф
  if (/\bangular\b/i.test(fullText)) score -= 500; // Уменьшаем штраф
  
  // 1C, Bitrix, Wordpress - средний штраф
  if (/1с|1c|битрикс|bitrix/i.test(fullText)) score -= 1000; // Уменьшаем штраф
  if (/wordpress|вордпресс/i.test(fullText)) score -= 1000; // Уменьшаем штраф
  
  // Modx, Drupal, Joomla
  if (/modx|drupal|joomla/i.test(fullText)) score -= 1000; // Уменьшаем штраф
  
  // Применяем штрафы
  score = score - penalty;
  
  // Минимальный score = 1 (чтобы вакансия не была отфильтрована)
  score = Math.max(1, Math.round(score));
  
  // Дополнительный бонус для высокорелевантных вакансий
  if (score > 50000) {
    score += 10000; // Дополнительный бонус для топ-вакансий
  }

  return score;
}