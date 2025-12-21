import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'hh-auto-apply-secret-key-change-in-production';

function getDb() {
  const dataDir = path.join(process.cwd(), '..', 'backend', 'data');
  const dbPath = path.join(dataDir, 'users.db');
  return new sqlite3.Database(dbPath);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Невалидный токен' }, { status: 401 });
    }

    const db = getDb();
    const dbGet = promisify(db.get.bind(db)) as (sql: string, params?: any[]) => Promise<any>;

    const user = await dbGet('SELECT id, email FROM users WHERE id = ?', [decoded.userId]);
    db.close();

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Auth check error:', error);
    return NextResponse.json({ error: 'Ошибка проверки авторизации' }, { status: 500 });
  }
}
