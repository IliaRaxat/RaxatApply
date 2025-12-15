@echo off
echo ========================================
echo HH.RU LOGIN DIAGNOSTIC TOOL
echo ========================================
echo.
echo This tool will help diagnose login issues with HH.ru
echo.
echo Press any key to start diagnostic...
pause >nul

cd /d "c:\Users\astra\Desktop\autoclick3.2"
node LOGIN_DIAGNOSTIC.js

echo.
echo Diagnostic completed. Check the results above.
echo.
echo Press any key to exit...
pause >nul