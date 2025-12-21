import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'hh-auto-apply-secret-key-change-in-production';

function getDb() {
  const dataDir = path.join(process.cwd(), '..', 'backend', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'users.db');
  return new sqlite3.Database(dbPath);
}

function getUserIdFromToken(request: NextRequest): number | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch {
    return null;
  }
}

// GET - загрузить резюме пользователя
export async function GET(request: NextRequest) {
  const userId = getUserIdFromToken(request);
  if (!userId) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const db = getDb();
  const dbAll = promisify(db.all.bind(db)) as (sql: string, params?: any[]) => Promise<any[]>;
  const dbRun = promisify(db.run.bind(db));

  try {
    // Создаём таблицу если не существует
    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        resume_slot INTEGER NOT NULL,
        cookies TEXT,
        hh_user_name TEXT,
        hh_user_email TEXT,
        gemini_key TEXT,
        cover_letter TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, resume_slot),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Миграция: добавляем колонки если их нет
    try {
      await dbRun('ALTER TABLE user_resumes ADD COLUMN hh_user_name TEXT');
    } catch (e) { /* колонка уже существует */ }
    try {
      await dbRun('ALTER TABLE user_resumes ADD COLUMN hh_user_email TEXT');
    } catch (e) { /* колонка уже существует */ }

    const resumes = await dbAll(
      'SELECT resume_slot, cookies, hh_user_name, hh_user_email, gemini_key, cover_letter FROM user_resumes WHERE user_id = ? ORDER BY resume_slot',
      [userId]
    );
    db.close();

    console.log(`[Resumes API] Loaded ${resumes.length} resumes for user ${userId}`);
    return NextResponse.json({ resumes });
  } catch (error: any) {
    db.close();
    console.error('Get resumes error:', error);
    return NextResponse.json({ error: 'Ошибка загрузки резюме' }, { status: 500 });
  }
}

// POST - сохранить резюме
export async function POST(request: NextRequest) {
  const userId = getUserIdFromToken(request);
  if (!userId) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    const { resumeSlot, cookies, hhUserName, hhUserEmail, geminiKey, coverLetter } = await request.json();

    if (!resumeSlot || resumeSlot < 1 || resumeSlot > 10) {
      return NextResponse.json({ error: 'Некорректный номер резюме' }, { status: 400 });
    }

    const db = getDb();
    const dbRun = promisify(db.run.bind(db));

    // Создаём таблицу если не существует
    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        resume_slot INTEGER NOT NULL,
        cookies TEXT,
        hh_user_name TEXT,
        hh_user_email TEXT,
        gemini_key TEXT,
        cover_letter TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, resume_slot),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Upsert - вставить или обновить
    await dbRun(`
      INSERT INTO user_resumes (user_id, resume_slot, cookies, hh_user_name, hh_user_email, gemini_key, cover_letter, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, resume_slot) DO UPDATE SET
        cookies = excluded.cookies,
        hh_user_name = excluded.hh_user_name,
        hh_user_email = excluded.hh_user_email,
        gemini_key = excluded.gemini_key,
        cover_letter = excluded.cover_letter,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, resumeSlot, cookies || null, hhUserName || null, hhUserEmail || null, geminiKey || null, coverLetter || null]);

    db.close();

    console.log(`[Resumes API] Saved resume slot ${resumeSlot} for user ${userId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Save resume error:', error);
    return NextResponse.json({ error: 'Ошибка сохранения резюме' }, { status: 500 });
  }
}
