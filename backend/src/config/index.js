// config/index.js

export const config = {
  // Параметры поиска вакансий - СУПЕР БЫСТРЫЙ СПИСОК (только самые эффективные)
  search: {
    queries: [
      // === ТОЛЬКО САМЫЕ ЭФФЕКТИВНЫЕ ЗАПРОСЫ ===
      { type: "text", value: 'Frontend разработчик' },
      { type: "text", value: 'React разработчик' },
      { type: "text", value: 'JavaScript разработчик' },
      { type: "text", value: 'Frontend' },
      { type: "text", value: 'React' },
      { type: "text", value: 'Frontend developer' },
      { type: "text", value: 'React developer' },
      { type: "text", value: 'Fullstack разработчик' },
      { type: "text", value: 'Middle Frontend' },
      { type: "text", value: 'Senior Frontend' },
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
      { word: "Webpack", weight: 2 },
      { word: "Vite", weight: 2 },
      { word: "Tailwind", weight: 2 },
      { word: "Styled Components", weight: 2 },
      { word: "GraphQL", weight: 2 },
      { word: "Jira", weight: 1 },
      { word: "Git", weight: 1 },
      { word: "Agile", weight: 1 },
      { word: "Scrum", weight: 1 },
      { word: "Figma", weight: 1 },
      { word: "UI/UX", weight: 1 },
      { word: "Responsive", weight: 1 },
      { word: "Mobile-first", weight: 1 },
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
    areas: [null],
    query: "frontend",
    area: 113,
    searchFields: ["name", "company_name", "description"],
    oredClusters: true,
    enableSnippets: false,
    LSaveArea: true,
  },

  // Правила фильтрации - МИНИМАЛЬНАЯ фильтрация
  filters: {
    stopWords: [
      // Только явно нерелевантные позиции
      "стажер", "стажёр", "intern", "интерн",
      "1с", "1c", "битрикс", "bitrix",
    ],
    requiredWords: [],
  },

  // Настройки Puppeteer
  puppeteer: {
    headless: false,
    slowMo: 0,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  },
  
  // Настройки задержек
  delays: {
    pageLoad: 100,
    afterClick: 50,
    betweenActions: 50,
    afterTyping: 30,
    beforeClose: 100
  }
};