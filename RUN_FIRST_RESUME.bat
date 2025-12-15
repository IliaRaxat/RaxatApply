@echo off
echo === ЗАПУСК ПЕРВОГО РЕЗЮМЕ ===
echo Убедитесь, что вы указали правильный email и пароль в backend/src/config/index.js
echo.
set RESUME_ID=1
node backend/src/main-with-auth-timer.js
pause