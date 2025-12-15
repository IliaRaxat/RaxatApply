@echo off
echo === ДЕБАГ МОДАЛЬНЫХ ОКОН ===
echo.

echo Запуск скрипта для отладки модальных окон...
cd backend
npm run debug-modals
cd ..

echo.
echo === ДЕБАГ ЗАВЕРШЕН ===
echo Браузер останется открытым для проверки
pause