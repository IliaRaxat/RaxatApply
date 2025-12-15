// Простой скрипт для проверки авторизации через API
const https = require('https');

async function checkAuthViaAPI(hhToken, xsrfToken) {
  return new Promise((resolve, reject) => {
    if (!hhToken || !xsrfToken) {
      console.log("❌ Токены не предоставлены");
      resolve(false);
      return;
    }
    
    const options = {
      hostname: 'hh.ru',
      port: 443,
      path: '/shards/employer/affiliate/current',
      method: 'GET',
      headers: {
        'Cookie': `HHTOKEN=${hhToken}; XSRF-TOKEN=${xsrfToken}`,
        'X-XSRF-TOKEN': xsrfToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    const req = https.request(options, (res) => {
      console.log(`Статус ответа: ${res.statusCode}`);
      
      if (res.statusCode === 200) {
        console.log("✅ Токены действительны!");
        resolve(true);
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        console.log("❌ Токены недействительны или истекли");
        resolve(false);
      } else {
        console.log(`❓ Неожиданный статус: ${res.statusCode}`);
        resolve(false);
      }
      
      res.on('data', (chunk) => {
        // Просто читаем данные, не выводим
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ Ошибка запроса: ${error.message}`);
      resolve(false);
    });
    
    req.setTimeout(10000, () => {
      console.log("⏰ Таймаут запроса");
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Получаем токены из переменных окружения
const hhToken = process.env.HH_TOKEN;
const xsrfToken = process.env.XSRF;

console.log("🚀 Проверка авторизации через API...");
console.log(`HH_TOKEN: ${hhToken ? "[ПРИСУТСТВУЕТ]" : "[ОТСУТСТВУЕТ]"}`);
console.log(`XSRF: ${xsrfToken ? "[ПРИСУТСТВУЕТ]" : "[ОТСУТСТВУЕТ]"}`);

if (!hhToken || !xsrfToken) {
  console.log("\n⚠️  Для проверки необходимы токены:");
  console.log("   Запустите с переменными окружения:");
  console.log("   HH_TOKEN=ваш_токен XSRF=ваш_xsrf_token node API_AUTH_CHECK.js");
  process.exit(1);
}

checkAuthViaAPI(hhToken, xsrfToken).then(isValid => {
  if (isValid) {
    console.log("\n🎉 Авторизация через API успешна!");
  } else {
    console.log("\n❌ Авторизация через API не удалась");
    console.log("💡 Попробуйте обновить токены в настройках");
  }
});