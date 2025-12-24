import { NextRequest, NextResponse } from 'next/server';
import { getProgress, clearProgress } from '@/shared/lib/progressStore';

export const dynamic = 'force-dynamic';

// GET - получить прогресс
export async function GET(
  request: NextRequest,
  { params }: { params: { resumeId: string } }
) {
  const { resumeId } = params;
  const progress = getProgress(resumeId);
  console.log(`[API Progress GET ${resumeId}]`, JSON.stringify(progress));
  
  return NextResponse.json(progress || { status: 'idle' }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    }
  });
}

// DELETE - очистить прогресс
export async function DELETE(
  request: NextRequest,
  { params }: { params: { resumeId: string } }
) {
  clearProgress(params.resumeId);
  return NextResponse.json({ success: true });
}
