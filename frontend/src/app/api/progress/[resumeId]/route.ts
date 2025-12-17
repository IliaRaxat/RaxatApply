import { NextRequest, NextResponse } from 'next/server';
import { getProgress } from '@/shared/lib/progressStore';

// GET endpoint для polling прогресса
export async function GET(
  request: NextRequest,
  { params }: { params: { resumeId: string } }
) {
  const { resumeId } = params;
  
  const progress = getProgress(resumeId);
  
  if (progress) {
    return NextResponse.json(progress);
  }
  
  // Если прогресса нет, возвращаем пустой объект
  return NextResponse.json({ status: 'idle' });
}
