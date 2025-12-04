// config/index.js

export const config = {
  // Данные для авторизации - 3 резюме
  resumes: [
    {
      id: 1,
      name: "Резюме 1",
      email: "ilshih@mail.ru",
      password: "твой_пароль_1",
      cookies: {
        HHTOKEN: "htOnjNQOTRdz_3u1mOs_429ZBsIz",
        XSRF: "542c53b2e77ebcfd19b96b024ac0208d",
      },
      geminiApiKey: "AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik"
    },
    {
      id: 2,
      name: "Резюме 2",
      email: "ilshih2@mail.ru",
      password: "твой_пароль_2",
      cookies: {
        HHTOKEN: "KCDUJriJp1fI5OzhSdfYWbsyC45j",
        XSRF: "542c53b2e77ebcfd19b96b024ac0208d",
      },
      geminiApiKey: "AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik"
    },
    {
      id: 3,
      name: "Резюме 3",
      email: "ishikhakhmedoa@mail.ru",
      password: "твой_пароль_3",
      cookies: {
        HHTOKEN: "fF4yzUgipZpcobm1t16JwHbQSctU",
        XSRF: "542c53b2e77ebcfd19b96b024ac0208d",
      },
      geminiApiKey: "AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik"
    }
  ],
  
  // Для обратной совместимости
  cookies: {
    HHTOKEN: "htOnjNQOTRdz_3u1mOs_429ZBsIz",
    XSRF: "542c53b2e77ebcfd19b96b024ac0208d",
  },
  geminiApiKeys: [
    "AIzaSyAMmvCu3iiPNVLk2UInbNAlpLZ-vwWZzik"
  ],

  // Параметры поиска вакансий
  search: {
    queries: [
      { type: "text", value: 'Frontend разработчик' },
      { type: "text", value: 'React разработчик' },
      { type: "text", value: 'Next.js разработчик' },
      { type: "text", value: 'TypeScript разработчик' },
      { type: "text", value: 'JavaScript разработчик' },
      { type: "text", value: 'Frontend developer' },
      { type: "text", value: 'React developer' },
      { type: "text", value: 'Web разработчик' },
      { type: "text", value: 'Фронтенд разработчик' },
      { type: "text", value: 'Фронтенд' },
      { type: "text", value: 'Frontend' },
      { type: "text", value: 'React' },
      { type: "text", value: 'Vue разработчик' },
      { type: "text", value: 'Angular разработчик' },
      { type: "text", value: 'Fullstack разработчик' },
      { type: "text", value: 'Full-stack developer' },
      { type: "text", value: 'Node.js разработчик' },
      { type: "text", value: 'JavaScript developer' },
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
      { word: "CSS", weight: 2 }
    ],
    areas: [113, 1, 2],
    query: "frontend",
    area: 113,
    searchFields: ["name", "company_name", "description"],
    oredClusters: true,
    enableSnippets: false,
    LSaveArea: true,
  },

  // Правила фильтрации
  filters: {
    stopWords: [
      "стажер", "стажёр", 
      "intern", "интерн",
      "flutter", "ios", "android", "mobile", "мобильн",
      "devops", "деvops",
      "qa", "тестировщик", "тестирование",
      "аналитик", "analyst",
      "designer", "дизайнер"
    ],
    requiredWords: [
      "react",
      "next.js",
      "nextjs"
    ],
  },

  // Настройки Puppeteer
  puppeteer: {
    headless: false,
    slowMo: 200,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  },
  
  // Настройки задержек
  delays: {
    pageLoad: 2000,
    afterClick: 1000,
    betweenActions: 1500,
    afterTyping: 500,
    beforeClose: 1000
  }
};
