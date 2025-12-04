// services/ai.js

import { GoogleGenAI } from "@google/genai";
import { config } from '../config/index.js';

function getRandomApiKey() {
  if (!config.geminiApiKeys || config.geminiApiKeys.length === 0) {
    throw new Error("В config не настроены ключи Gemini API");
  }
  const randomIndex = Math.floor(Math.random() * config.geminiApiKeys.length);
  return config.geminiApiKeys[randomIndex];
}

function initializeGeminiClient() {
  const apiKey = getRandomApiKey();
  return new GoogleGenAI({ apiKey });
}

function handleFallbackAnswer(questionText) {
  if (!questionText) return "";
  const q = questionText.toLowerCase();
  
  if (q.includes('зарплат') || q.includes('вознагражд')) {
    return 'По рыночным условиям, готов обсудить на интервью.';
  }
  if (q.includes('стаж') || q.includes('опыт')) {
    return 'Имею более 4 лет релевантного опыта в frontend.';
  }
  if (q.includes('готовы ли') || q.includes('переезд')) {
    return 'Готов обсудить формат работы.';
  }
  if (q.includes('образован') || q.includes('высшее')) {
    return 'Есть высшее техническое образование.';
  }
  return 'Мой опыт соответствует требованиям; готов обсудить детали на собеседовании.';
}

async function withRetry(fn, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if ((error.status === 503 || error.status === 429) && i < retries - 1) {
        console.warn(`Модель перегружена (${error.status}). Повтор через ${delayMs / 1000}с...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error("Максимальное количество попыток достигнуто.");
}

export async function generateAnswerForQuestion(questionText, resumeContent, vacancyDescription) {
  questionText = questionText ? questionText.trim() : '';
  const ai = initializeGeminiClient();

  const prompt = `
Ты — frontend-кандидат, отвечающий на вопросы от работодателя.

Резюме:
${resumeContent}

Описание вакансии:
${vacancyDescription}

Вопрос: "${questionText}"

Правила:
- Отвечай кратко, 1-2 предложения
- Подчеркни релевантность под вакансию
- Не пиши "нет", "не знаю" - адаптируй ответ

Ответь только по сути.`;

  try {
    const response = await withRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
    });

    return response?.text || handleFallbackAnswer(questionText);
  } catch (error) {
    console.error("Ошибка Gemini AI:", error);
    return handleFallbackAnswer(questionText);
  }
}

export async function chooseBestOptionAI(questionText, options, resumeContent, vacancyDescription) {
  if (!options || options.length === 0) return null;

  const ai = initializeGeminiClient();
  const optionsList = options.map((opt, index) => `${index + 1}. ${opt}`).join('\n');
  
  const prompt = `Ты — кандидат на Frontend-разработчика.

Резюме:
${resumeContent}

Вакансия:
${vacancyDescription}

Вопрос: ${questionText}

Варианты:
${optionsList}

Ответь ТОЛЬКО номером варианта (1, 2, 3...) или "0" если ничего не подходит.`;

  try {
    const response = await withRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
    });

    if (response?.text) {
      const chosenIndex = parseInt(response.text.trim()) - 1;
      if (!isNaN(chosenIndex) && chosenIndex >= 0 && chosenIndex < options.length) {
        return options[chosenIndex];
      }
    }
    
    for (const opt of options) {
      if (/да\b/i.test(opt)) return opt;
    }
    return options[0] || null;
  } catch (error) {
    console.error("Ошибка Gemini AI:", error);
    for (const opt of options) {
      if (/да\b/i.test(opt)) return opt;
    }
    return options[0] || null;
  }
}

export async function chooseBestOptionsAI(questionText, options, resumeContent, vacancyDescription) {
  if (!options || options.length === 0) return [];

  const ai = initializeGeminiClient();
  const optionsList = options.map((opt, index) => `${index + 1}. ${opt}`).join('\n');
  
  const prompt = `Ты — кандидат на Frontend-разработчика.

Резюме:
${resumeContent}

Вакансия:
${vacancyDescription}

Вопрос: ${questionText}

Варианты (можно несколько):
${optionsList}

Ответь ТОЛЬКО номерами через запятую (1,3,5) или "0".`;

  try {
    const response = await withRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
    });

    if (response?.text) {
      const aiResponse = response.text.trim();
      if (aiResponse === '0') return [];

      const chosenIndices = aiResponse.split(',')
        .map(s => parseInt(s.trim()) - 1)
        .filter(n => !isNaN(n) && n >= 0 && n < options.length);
      
      return chosenIndices.map(index => options[index]);
    }
    
    const chosen = options.filter(opt => /да\b/i.test(opt));
    return chosen.length > 0 ? chosen : [options[0]];
  } catch (error) {
    console.error("Ошибка Gemini AI:", error);
    const chosen = options.filter(opt => /да\b/i.test(opt));
    return chosen.length > 0 ? chosen : [options[0]];
  }
}

export async function generateCoverLetter(vacancy, resumeContent) {
  const ai = initializeGeminiClient();
  
  const prompt = `
Напиши короткое сопроводительное сообщение для отклика.

Вакансия:
- Название: ${vacancy.title}
- Компания: ${vacancy.company}
- Описание: ${vacancy.description || "Не указано."}

Резюме:
${resumeContent}

Правила:
1. Максимально релевантно вакансии
2. 1-2 предложения
3. Без приветствий и прощаний
4. Кратко, уверенно, по делу

Выведи только текст сообщения.`;

  try {
    const response = await withRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
    });

    return response?.text || null;
  } catch (error) {
    console.error("Ошибка генерации письма:", error);
    return null;
  }
}
