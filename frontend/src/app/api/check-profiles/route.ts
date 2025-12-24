import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Отключаем статическую генерацию
export const dynamic = 'force-dynamic';

// GET - проверить какие профили браузера существуют
export async function GET(request: NextRequest) {
  try {
    const profilesDir = path.join(process.cwd(), '..', 'backend', 'chrome-profiles');
    
    const profiles: Record<string, boolean> = {};
    
    // Проверяем профили для резюме 1-10
    for (let i = 1; i <= 10; i++) {
      const profilePath = path.join(profilesDir, `resume_${i}`);
      // Профиль считается валидным если есть папка Default или Cookies
      const hasProfile = fs.existsSync(profilePath) && 
        (fs.existsSync(path.join(profilePath, 'Default')) || 
         fs.existsSync(path.join(profilePath, 'Cookies')) ||
         fs.readdirSync(profilePath).length > 0);
      profiles[String(i)] = hasProfile;
    }
    
    return NextResponse.json({ profiles });
  } catch (error: any) {
    console.error('Check profiles error:', error);
    return NextResponse.json({ profiles: {} });
  }
}
