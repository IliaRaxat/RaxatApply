@echo off
echo === БЫСТРЫЙ ТЕСТ СИСТЕМЫ ===
echo.

echo 1. Запуск теста авторизации...
cd backend
npm run test-auth
cd ..

echo.
echo === ТЕСТ ЗАВЕРШЕН ===
pause