@echo off
echo === БЫСТРЫЙ ТЕСТ ВСЕХ РЕЗЮМЕ ===
echo.

echo === ТЕСТ БАЗЫ ДАННЫХ ===
node backend/src/scripts/clear_db.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка базы данных
    pause
    exit /b 1
)
echo ✅ База данных очищена
echo.

echo === ТЕСТ ПОДКЛЮЧЕНИЯ К HH.RU ===
node test-hh-access.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка подключения к HH.ru
    pause
    exit /b 1
)
echo ✅ Подключение к HH.ru работает
echo.

echo === ТЕСТ ПАРСИНГА (РЕЗЮМЕ 1) ===
set RESUME_ID=1
set TEST_MODE=true
node backend/src/main.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка парсинга для резюме 1
    pause
    exit /b 1
)
echo ✅ Парсинг для резюме 1 завершен
echo.

echo === Все тесты пройдены успешно! ===
pause