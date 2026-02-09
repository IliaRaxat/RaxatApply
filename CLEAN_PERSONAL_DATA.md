# Очистка личных данных

Этот файл содержит инструкции по полной очистке всех личных данных из программы.

## Что нужно удалить перед публикацией

### 1. База данных
```bash
# Windows
del /f /q backend\data\app.db

# Linux/Mac
rm -f backend/data/app.db
```

### 2. Профили браузера (содержат сессии и куки)
```bash
# Windows
rmdir /s /q backend\chrome-profiles

# Linux/Mac
rm -rf backend/chrome-profiles
```

### 3. Файл прогресса
```bash
# Windows
del /f /q .progress-store.json
del /f /q frontend\.progress-store.json

# Linux/Mac
rm -f .progress-store.json
rm -f frontend/.progress-store.json
```

### 4. Переменные окружения
```bash
# Windows
del /f /q backend\.env
del /f /q frontend\.env
del /f /q .env

# Linux/Mac
rm -f backend/.env frontend/.env .env
```

### 5. Логи
```bash
# Windows
del /f /q *.log

# Linux/Mac
rm -f *.log
```

## Автоматическая очистка

### Windows (PowerShell)
```powershell
.\clean-data.ps1
```

## Проверка перед публикацией

Убедитесь что:
- [ ] База данных удалена (`backend/data/app.db`)
- [ ] Профили браузера удалены (`backend/chrome-profiles/`)
- [ ] Файлы прогресса удалены (`.progress-store.json`)
- [ ] Все `.env` файлы удалены
- [ ] Логи удалены (`*.log`)
- [ ] В коде нет личных данных (имена, email, токены)
- [ ] Сопроводительное письмо пустое по умолчанию
- [ ] Одно резюме по умолчанию

## Что остается

После очистки в программе остаются только:
- ✅ Исходный код
- ✅ Конфигурационные файлы (`.env.example`)
- ✅ Документация
- ✅ Зависимости (`package.json`)

## Первый запуск после очистки

1. Запустите программу:
   ```bash
   cd frontend && npm run dev
   ```

2. Зарегистрируйтесь в системе
3. Введите свой Gemini API ключ
4. Введите сопроводительное письмо
5. Нажмите "Запустить" и войдите в HH.ru

Программа автоматически создаст:
- Новую базу данных
- Профиль браузера для вашего аккаунта
- Сохранит ваши настройки
