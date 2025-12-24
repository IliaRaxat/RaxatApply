'use client';

import { useCallback, useRef } from 'react';
import { Resume } from '@/shared/types';

interface UseProcessPollingProps {
  resumeId: string;
  vacancyCount: number;
  onUpdate: (id: string, updates: Partial<Resume>) => void;
  onComplete: () => void;
}

export function useProcessPolling({ resumeId, vacancyCount, onUpdate, onComplete }: UseProcessPollingProps) {
  const isPollingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    console.log(`[useProcessPolling ${resumeId}] STOP`);
    isPollingRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [resumeId]);

  const startPolling = useCallback(() => {
    if (isPollingRef.current) {
      console.log(`[useProcessPolling ${resumeId}] Already running, skip`);
      return;
    }
    
    console.log(`[useProcessPolling ${resumeId}] START polling`);
    isPollingRef.current = true;

    const poll = async () => {
      if (!isPollingRef.current) {
        console.log(`[useProcessPolling ${resumeId}] Polling stopped, skip fetch`);
        return;
      }

      try {
        console.log(`[useProcessPolling ${resumeId}] Fetching...`);
        const response = await fetch(`/api/progress/${resumeId}?t=${Date.now()}`);
        const data = await response.json();
        
        console.log(`[useProcessPolling ${resumeId}] Got data:`, JSON.stringify(data));

        if (!isPollingRef.current) return;

        // Формируем updates
        const updates: Partial<Resume> = {};

        if (data.status) {
          updates.status = data.status;
        }

        updates.progress = {
          parsed: data.parsed ?? 0,
          target: data.target ?? vacancyCount,
          applied: data.applied ?? 0,
          successCount: data.successCount ?? 0,
          failedCount: data.failedCount ?? 0,
          totalCount: data.totalCount ?? 0,
        };

        if (data.topVacancies?.length > 0) {
          updates.topVacancies = data.topVacancies;
        }

        if (data.extractedTokens) {
          updates.hhtoken = data.extractedTokens.hhtoken;
          updates.xsrf = data.extractedTokens.xsrf;
          if (data.extractedTokens.userName) updates.hhUserName = data.extractedTokens.userName;
          if (data.extractedTokens.userEmail) updates.hhUserEmail = data.extractedTokens.userEmail;
        }

        console.log(`[useProcessPolling ${resumeId}] Calling onUpdate with:`, JSON.stringify(updates));
        onUpdate(resumeId, updates);

        if (data.status === 'completed' || data.status === 'error') {
          console.log(`[useProcessPolling ${resumeId}] Process ended: ${data.status}`);
          stopPolling();
          onComplete();
        }
      } catch (error) {
        console.error(`[useProcessPolling ${resumeId}] Fetch error:`, error);
      }
    };

    // Первый запрос сразу
    poll();
    
    // Потом каждую секунду
    intervalRef.current = setInterval(poll, 1000);
  }, [resumeId, vacancyCount, onUpdate, onComplete, stopPolling]);

  return { startPolling, stopPolling };
}
