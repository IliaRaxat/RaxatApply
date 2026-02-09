# Скрипт для полной очистки личных данных
# Запустите из корня проекта: .\clean-data.ps1

Write-Host "🧹 Начинаем очистку личных данных..." -ForegroundColor Yellow

# База данных
if (Test-Path "backend\data\app.db") {
    Remove-Item -Force "backend\data\app.db"
    Write-Host "✅ База данных удалена" -ForegroundColor Green
} else {
    Write-Host "ℹ️  База данных не найдена" -ForegroundColor Gray
}

# Профили браузера
if (Test-Path "backend\chrome-profiles") {
    Remove-Item -Force -Recurse "backend\chrome-profiles"
    Write-Host "✅ Профили браузера удалены" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Профили браузера не найдены" -ForegroundColor Gray
}

# Файл прогресса
if (Test-Path ".progress-store.json") {
    Remove-Item -Force ".progress-store.json"
    Write-Host "✅ Файл прогресса удален" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Файл прогресса не найден" -ForegroundColor Gray
}

if (Test-Path "frontend\.progress-store.json") {
    Remove-Item -Force "frontend\.progress-store.json"
    Write-Host "✅ Frontend файл прогресса удален" -ForegroundColor Green
}

# .env файлы
$envFiles = @("backend\.env", "frontend\.env", ".env")
foreach ($file in $envFiles) {
    if (Test-Path $file) {
        Remove-Item -Force $file
        Write-Host "✅ $file удален" -ForegroundColor Green
    }
}

# Логи
$logs = Get-ChildItem -Filter "*.log" -ErrorAction SilentlyContinue
if ($logs) {
    $logs | Remove-Item -Force
    Write-Host "✅ Логи удалены ($($logs.Count) файлов)" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Все личные данные успешно удалены!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. Запустите программу: cd frontend && npm run dev" -ForegroundColor White
Write-Host "2. Зарегистрируйтесь и настройте свои данные" -ForegroundColor White
