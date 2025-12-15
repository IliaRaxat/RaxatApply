@echo off
echo === ТЕСТ АВТОРИЗАЦИИ ЧЕРЕЗ API ===
echo.

echo Запуск теста авторизации через API...
cd backend
npm run test-api-auth
cd ..

echo.
echo === ТЕСТ ЗАВЕРШЕН ===
pause