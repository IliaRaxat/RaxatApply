# HH Auto Apply

Автоматизация откликов на вакансии HH.ru

## Структура проекта

```
├── frontend/                 # Next.js приложение
│   ├── src/
│   │   ├── app/             # App Router (страницы и API)
│   │   │   ├── api/         # API routes
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/      # React компоненты
│   │   ├── lib/             # Утилиты и хелперы
│   │   ├── styles/          # CSS стили
│   │   └── types/           # TypeScript типы
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                  # Node.js приложение
│   ├── src/
│   │   ├── api/             # Express API сервер
│   │   ├── applicator/      # Логика откликов
│   │   ├── config/          # Конфигурация
│   │   ├── db/              # База данных (SQLite)
│   │   ├── parser/          # Парсер вакансий
│   │   ├── scripts/         # Вспомогательные скрипты
│   │   ├── services/        # Сервисы (AI, HTTP, Puppeteer)
│   │   └── main.js          # Точка входа
│   ├── data/                # Файлы БД (создается автоматически)
│   └── package.json
│
└── package.json              # Корневой package.json
```

## Установка

```bash
# Установить все зависимости
npm run install:all

# Или по отдельности
cd frontend && npm install
cd backend && npm install
```

## Запуск

### Разработка

```bash
# Запустить frontend и backend одновременно
npm run dev

# Или по отдельности
npm run dev:frontend  # http://localhost:3000
npm run dev:backend   # Консольное приложение
```

### API сервер

```bash
npm run api  # http://localhost:3001
```

## Конфигурация

Настройки находятся в `backend/src/config/index.js`:

- `resumes` - данные для авторизации (токены, ключи)
- `search.queries` - поисковые запросы
- `search.keywords` - ключевые слова для ранжирования
- `filters` - стоп-слова и обязательные слова
- `puppeteer` - настройки браузера

## Как это работает

1. **Парсинг** - собирает вакансии с HH.ru по заданным запросам
2. **Рейтинг** - сортирует вакансии по релевантности
3. **Отклик** - автоматически откликается на топ вакансии

## Технологии

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- Express
- Puppeteer
- SQLite
- Google Gemini AI
