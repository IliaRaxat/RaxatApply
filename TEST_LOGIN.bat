@echo off
echo === ТЕСТ АВТОРИЗАЦИИ ===
echo.

echo Запуск теста авторизации...
cd backend
npm run quick-login
cd ..

echo.
echo === ТЕСТ ЗАВЕРШЕН ===
echo Браузер останется открытым для проверки
pause