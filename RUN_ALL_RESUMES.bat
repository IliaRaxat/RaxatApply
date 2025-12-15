@echo off
echo === ЗАПУСК ВСЕХ РЕЗЮМЕ ПО ОЧЕРЕДИ ===
echo.

echo === ОЧИСТКА БАЗЫ ДАННЫХ ===
node backend/src/scripts/clear_db.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка очистки базы данных
    pause
    exit /b 1
)
echo ✅ База данных очищена
echo.

echo === ЗАПУСК РЕЗЮМЕ 1 ===
echo Убедитесь, что вы вошли в аккаунт для резюме 1 в открывшемся браузере
set RESUME_ID=1
set TEST_MODE=false
node backend/src/main-with-auth-timer.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка запуска резюме 1
    pause
    exit /b 1
)
echo ✅ Резюме 1 завершено
echo.

timeout /t 10 /nobreak >nul

echo === ЗАПУСК РЕЗЮМЕ 2 ===
echo Убедитесь, что вы вошли в аккаунт для резюме 2 в открывшемся браузере
set RESUME_ID=2
set TEST_MODE=false
node backend/src/main-with-auth-timer.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка запуска резюме 2
    pause
    exit /b 1
)
echo ✅ Резюме 2 завершено
echo.

timeout /t 10 /nobreak >nul

echo === ЗАПУСК РЕЗЮМЕ 3 ===
echo Убедитесь, что вы вошли в аккаунт для резюме 3 в открывшемся браузере
set RESUME_ID=3
set TEST_MODE=false
node backend/src/main-with-auth-timer.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка запуска резюме 3
    pause
    exit /b 1
)
echo ✅ Резюме 3 завершено
echo.

echo === ВСЕ РЕЗЮМЕ ЗАВЕРШЕНЫ УСПЕШНО! ===
pause