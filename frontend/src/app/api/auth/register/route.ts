import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть минимум 6 символов' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
    }

    const db = getDb();
    const dbRun = promisify(db.run.bind(db));
    const dbGet = promisify(db.get.bind(db)) as (sql: string, params?: any[]) => Promise<any>;

    // Создаём таблицу если не существует
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Проверяем существует ли пользователь
    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) {
      db.close();
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 400 });
    }

    // Хешируем пароль и создаём пользователя
    const passwordHash = await bcrypt.hash(password, 10);
    await dbRun('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email.toLowerCase(), passwordHash]);
    
    const user = await dbGet('SELECT id, email FROM users WHERE email = ?', [email.toLowerCase()]);
    db.close();

    // Генерируем токен
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      token
    });
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json({ error: error.message || 'Ошибка регистрации' }, { status: 500 });
  }
}
