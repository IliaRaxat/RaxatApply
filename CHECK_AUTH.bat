@echo off
echo === ПРОВЕРКА АВТОРИЗАЦИИ ===
echo.

echo Запуск проверки авторизации...
cd backend
npm run auth-only
cd ..

echo.
echo === ПРОВЕРКА ЗАВЕРШЕНА ===
echo Браузер останется открытым для проверки
pause