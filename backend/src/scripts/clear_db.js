// scripts/clear_db.js - Очистка базы данных

import { initializeDatabase, dbRun } from '../db/database.js';

async function clearDatabase() {
  console.log('🗑️  Очистка базы данных...');
  
  try {
    await initializeDatabase();
    
    await dbRun('DELETE FROM survey_answers');
    await dbRun('DELETE FROM vacancy_details');
    await dbRun('DELETE FROM vacancies');
    await dbRun('DELETE FROM sqlite_sequence');
    
    console.log('✅ База данных очищена');
  } catch (error) {
    console.error('❌ Ошибка очистки:', error.message);
    process.exit(1);
  }
}

clearDatabase();
