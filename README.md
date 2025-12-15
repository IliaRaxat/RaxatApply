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

### Тестовый режим

По умолчанию программа работает в тестовом режиме и собирает только 30 вакансий.

### Production режим (настраиваемое количество вакансий)

Вы можете выбрать количество вакансий для парсинга: 50, 300, 700, 1000, 2000.

```bash
# Windows (бэкенд)
copy backend\.env.production backend\.env
# Windows (фронтенд)
copy frontend\.env.production frontend\.env

# Linux/Mac (бэкенд)
cp backend/.env.production backend/.env
# Linux/Mac (фронтенд)
cp frontend/.env.production frontend/.env

# Затем отредактируйте файл .env и измените значение VACANCY_COUNT:
# VACANCY_COUNT=50    # или 300, 700, 1000, 2000

# Или используйте удобный скрипт SET_VACANCY_COUNT.bat:
# Дважды щелкните по файлу и выберите нужное количество

# Затем запустите как обычно
npm run dev
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

### Этапы работы программы

1. **Фаза авторизации (5 минут)**
   - Открывается браузер с возможностью ручной авторизации
   - Пользователь входит в аккаунт hh.ru вручную
   - Система автоматически извлекает токены авторизации

2. **Фаза парсинга**
   - Сбор вакансий с HH.ru по заданным запросам
   - Фильтрация по стоп-словам
   - Сохранение в базу данных SQLite

3. **Фаза рейтинга**
   - Анализ вакансий через Google Gemini AI
   - Сортировка по релевантности
   - Выбор топ-400 вакансий

4. **Фаза отклика**
   - Автоматические отклики на топ вакансии
   - Обработка модальных окон
   - Сохранение статуса откликов

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

## Скрипты диагностики

Для проверки работы системы доступны следующие скрипты:

- `RUN_FULL_CHECK.bat` - Полная проверка системы
- `RUN_PARSING_TEST.bat` - Тест парсинга вакансий
- `RUN_RATING_TEST.bat` - Тест рейтинга вакансий
- `HOW_IT_WORKS.md` - Подробное описание работы программы