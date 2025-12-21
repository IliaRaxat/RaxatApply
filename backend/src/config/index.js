// config/index.js

export const config = {
  // Авторизация происходит вручную через браузер
  // Gemini API ключ передаётся через UI

  // Параметры поиска вакансий - РАСШИРЕННЫЙ СПИСОК для большего охвата
  search: {
    queries: [
      // Основные запросы
      { type: "text", value: 'Frontend разработчик' },
      { type: "text", value: 'React разработчик' },
      { type: "text", value: 'JavaScript разработчик' },
      { type: "text", value: 'TypeScript разработчик' },
      { type: "text", value: 'Фронтенд' },
      { type: "text", value: 'Fullstack' },
      { type: "text", value: 'Next.js' },
      { type: "text", value: 'Web разработчик' },
      { type: "text", value: 'Веб-разработчик' },
      { type: "text", value: 'Node.js разработчик' },
      { type: "text", value: 'Верстальщик' },
      // Дополнительные технологии
      { type: "text", value: 'Vue.js разработчик' },
      { type: "text", value: 'Angular разработчик' },
      { type: "text", value: 'Redux' },
      { type: "text", value: 'GraphQL разработчик' },
      // Уровни
      { type: "text", value: 'Junior Frontend' },
      { type: "text", value: 'Middle Frontend' },
      { type: "text", value: 'Senior Frontend' },
      { type: "text", value: 'Junior React' },
      { type: "text", value: 'Middle React' },
      // Английские варианты
      { type: "text", value: 'Frontend developer' },
      { type: "text", value: 'Frontend engineer' },
      { type: "text", value: 'React developer' },
      { type: "text", value: 'JavaScript developer' },
      // Удалённая работа
      { type: "text", value: 'Frontend удаленно' },
      { type: "text", value: 'React удаленная работа' },
      { type: "text", value: 'JavaScript remote' },
      { type: "text", value: 'Фронтенд удаленно' },
      // Специализации
      { type: "text", value: 'UI разработчик' },
      { type: "text", value: 'HTML верстальщик' },
      { type: "text", value: 'CSS верстка' },
      { type: "text", value: 'Программист JavaScript' },
      { type: "text", value: 'Разработчик интерфейсов' },
    ],
    keywords: [
      { word: "React", weight: 10 },
      { word: "Next.js", weight: 9 },
      { word: "NextJs", weight: 9 },
      { word: "TypeScript", weight: 8 },
      { word: "Redux Toolkit", weight: 7 },
      { word: "Redux", weight: 6 },
      { word: "Frontend", weight: 7 },
      { word: "JavaScript", weight: 6 },
      { word: "Node.js", weight: 5 },
      { word: "REST API", weight: 4 },
      { word: "Docker", weight: 4 },
      { word: "Kubernetes", weight: 3 },
      { word: "PostgreSQL", weight: 3 },
      { word: "CI/CD", weight: 3 },
      { word: "Jest", weight: 2 },
      { word: "AWS", weight: 2 },
      { word: "HTML", weight: 2 },
      { word: "CSS", weight: 2 },
      // Добавляем больше ключевых слов
      { word: "Webpack", weight: 2 },
      { word: "Vite", weight: 2 },
      { word: "Tailwind", weight: 2 },
      { word: "Styled Components", weight: 2 },
      { word: "GraphQL", weight: 2 },
      { word: "Jira", weight: 1 },
      { word: "Git", weight: 1 },
      // Дополнительные ключевые слова
      { word: "Agile", weight: 1 },
      { word: "Scrum", weight: 1 },
      { word: "Figma", weight: 1 },
      { word: "UI/UX", weight: 1 },
      { word: "Responsive", weight: 1 },
      { word: "Mobile-first", weight: 1 },
      // Дополнительные ключевые слова
      { word: "ES6", weight: 1 },
      { word: "ESLint", weight: 1 },
      { word: "Prettier", weight: 1 },
      { word: "Babel", weight: 1 },
      { word: "Sass", weight: 1 },
      { word: "Less", weight: 1 },
      { word: "Bootstrap", weight: 1 },
      { word: "Material UI", weight: 1 },
      { word: "Ant Design", weight: 1 },
      { word: "Chakra UI", weight: 1 }
    ],
    // Без фильтра по регионам - все регионы
    areas: [null], // Упрощаем до одного значения, так как мы больше не используем этот параметр
    query: "frontend",
    area: 113,
    searchFields: ["name", "company_name", "description"],
    oredClusters: true,
    enableSnippets: false,
    LSaveArea: true,
  },

  // Правила фильтрации - только явно нерелевантные
  filters: {
    stopWords: [
      // Уровень - только стажёры
      "стажер", "стажёр", "intern", "интерн",
      // Другие фреймворки (только в заголовке)
      //"angular", "vue.js", "vuejs", // Переносим в более мягкую фильтрацию
      // Явно не frontend
      "flutter", "ios разработчик", "android разработчик",
      "devops", "qa", "тестировщик",
      "аналитик", "analyst", "designer", "дизайнер",
      "1с", "1c", "битрикс", "bitrix",
      "data engineer", "data scientist", "ml engineer",
      "системный администратор", "sysadmin",
      "backend", "бэкенд", "back-end", "back end"
    ],
    requiredWords: [],
  },

  // Настройки Puppeteer
  puppeteer: {
    headless: false,
    slowMo: 0, // Убираем замедление для максимальной скорости
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  },
  
  // Настройки задержек - минимальные для скорости
  delays: {
    pageLoad: 100,
    afterClick: 50,
    betweenActions: 50,
    afterTyping: 30,
    beforeClose: 100
  }
};