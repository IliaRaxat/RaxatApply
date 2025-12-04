import { NextRequest } from 'next/server';
import { getProgress } from '@/lib/progressStore';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { resumeId: string } }
) {
  const resumeId = params.resumeId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let lastData = '';

      const interval = setInterval(() => {
        const progress = getProgress(resumeId);
        const data = JSON.stringify(progress || {});

        // Отправляем только если данные изменились
        if (data !== lastData) {
          lastData = data;
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        // Закрываем поток если процесс завершен
        if (progress?.status === 'completed' || progress?.status === 'error') {
          clearInterval(interval);
          controller.close();
        }
      }, 500);

      // Очистка при закрытии соединения
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
