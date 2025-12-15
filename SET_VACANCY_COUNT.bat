@echo off
setlocal enabledelayedexpansion

echo Выберите количество вакансий для парсинга:
echo 1. 50 вакансий
echo 2. 300 вакансий
echo 3. 700 вакансий
echo 4. 1000 вакансий
echo.

choice /c 1234 /m "Выберите вариант"

if %errorlevel% == 1 (
    echo VACANCY_COUNT=50 > .env
    echo Установлено количество вакансий: 50
) else if %errorlevel% == 2 (
    echo VACANCY_COUNT=300 > .env
    echo Установлено количество вакансий: 300
) else if %errorlevel% == 3 (
    echo VACANCY_COUNT=700 > .env
    echo Установлено количество вакансий: 700
) else if %errorlevel% == 4 (
    echo VACANCY_COUNT=1000 > .env
    echo Установлено количество вакансий: 1000
)

echo.
echo Переменная окружения VACANCY_COUNT успешно обновлена в файле .env
echo.
pause