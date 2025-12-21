// services/auth.js - Сервис авторизации

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail, getUserById } from '../db/users.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hh-auto-apply-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export async function register(email, password) {
  if (!email || !password) {
    throw new Error('Email и пароль обязательны');
  }

  if (password.length < 6) {
    throw new Error('Пароль должен быть минимум 6 символов');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Некорректный email');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser(email.toLowerCase(), passwordHash);
  
  const token = generateToken(user.id);
  
  return {
    user: { id: user.id, email: user.email },
    token
  };
}

export async function login(email, password) {
  if (!email || !password) {
    throw new Error('Email и пароль обязательны');
  }

  const user = await getUserByEmail(email.toLowerCase());
  
  if (!user) {
    throw new Error('Неверный email или пароль');
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    throw new Error('Неверный email или пароль');
  }

  const token = generateToken(user.id);
  
  return {
    user: { id: user.id, email: user.email },
    token
  };
}

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function getUserFromToken(token) {
  const decoded = verifyToken(token);
  if (!decoded) return null;
  
  const user = await getUserById(decoded.userId);
  return user;
}
