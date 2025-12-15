@echo off
echo === ПОДРОБНАЯ ОТЛАДКА АВТОРИЗАЦИИ ===
echo.

echo Запуск подробной отладки авторизации...
cd backend
npm run debug-auth-flow
cd ..

echo.
echo === ОТЛАДКА ЗАВЕРШЕНА ===
echo Браузер останется открытым для проверки
pause