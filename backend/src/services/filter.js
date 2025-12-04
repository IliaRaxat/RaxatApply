// services/filter.js

import { config } from '../config/index.js';

/**
 * Проверяет, соответствует ли вакансия фильтрам
 */
export function isVacancySuitable(vacancy) {
  const { stopWords, requiredWords } = config.filters;
  
  const fullText = [
    vacancy.title || '',
    vacancy.company || '',
    vacancy.description_text || ''
  ].join(' ').toLowerCase();
  
  if (stopWords && stopWords.length > 0) {
    for (const stopWord of stopWords) {
      if (fullText.includes(stopWord.toLowerCase())) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Вычисляет релевантность вакансии
 */
export function calculateVacancyRelevance(vacancy) {
  const keywordConfig = (config.search && Array.isArray(config.search.keywords) && config.search.keywords.length > 0)
    ? config.search.keywords
    : [
        { word: 'React', weight: 10 },
        { word: 'Next.js', weight: 9 },
        { word: 'NextJs', weight: 9 },
        { word: 'TypeScript', weight: 8 },
        { word: 'Redux Toolkit', weight: 7 },
        { word: 'Redux', weight: 6 },
        { word: 'Frontend', weight: 7 },
        { word: 'JavaScript', weight: 6 },
        { word: 'Node.js', weight: 5 },
      ];

  const fullText = [vacancy.title || '', vacancy.company || '', vacancy.description_text || ''].join(' ').toLowerCase();
  const titleText = (vacancy.title || '').toLowerCase();
  const descText = (vacancy.description_text || '').toLowerCase();

  let score = 0;

  for (const kw of keywordConfig) {
    const word = (kw.word || '').toLowerCase();
    const weight = Number(kw.weight) || 0;
    if (!word || weight === 0) continue;

    // Проверяем наличие слова
    if (titleText.includes(word)) {
      score += weight * 3; // В названии - тройной вес
    }
    if (descText.includes(word)) {
      score += weight; // В описании - обычный вес
    }
  }

  // Бонусы за комбинации
  const hasReact = /react/i.test(fullText);
  const hasNext = /next\.?js/i.test(fullText);
  const hasTS = /typescript/i.test(fullText);

  if (hasReact && hasNext) score += 20;
  if (hasReact && hasTS) score += 10;

  // Штрафы за другие фреймворки
  if (/\bvue\b/i.test(fullText)) score -= 5;
  if (/\bangular\b/i.test(fullText)) score -= 5;

  return Math.max(0, Math.round(score));
}
