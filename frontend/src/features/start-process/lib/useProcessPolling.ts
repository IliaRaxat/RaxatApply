'use client';

import { useCallback, useRef } from 'react';
import { Resume } from '@/shared/types';
import { fetchProgress } from '@/shared/api';

interface UseProcessPollingProps {
  resumeId: string;
  vacancyCount: number;
  onUpdate: (id: string, updates: Partial<Resume>) => void;
  onComplete: () => void;
  onTokensExtracted?: (tokens: { hhtoken: string; xsrf: string }) => void;
}

export function useProcessPolling({ resumeId, vacancyCount, onUpdate, onComplete, onTokensExtracted }: UseProcessPollingProps) {
  const pollingRef = useRef<boolean>(false);
  const tokensExtractedRef = useRef<boolean>(false);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    tokensExtractedRef.current = false;

    const pollProgress = async () => {
      if (!pollingRef.current) return;

      try {
        const data = await fetchProgress(resumeId);

        const updates: Partial<Resume> = {};
        
        if (data.status && data.status !== 'idle') {
          updates.status = data.status;
        }
        
        if (data.parsed !== undefined || data.target !== undefined) {
          updates.progress = {
            parsed: data.parsed ?? 0,
            target: data.target ?? vacancyCount,
            applied: data.applied ?? 0,
            successCount: data.successCount ?? 0,
            failedCount: data.failedCount ?? 0,
            totalCount: data.totalCount ?? 0,
          };
        }
        
        if (data.topVacancies && data.topVacancies.length > 0) {
          updates.topVacancies = data.topVacancies;
        }
        
        // Сохраняем извлечённые токены
        if (data.extractedTokens && !tokensExtractedRef.current) {
          console.log('[Polling] Extracted tokens received:', data.extractedTokens);
          tokensExtractedRef.current = true;
          updates.hhtoken = data.extractedTokens.hhtoken;
          updates.xsrf = data.extractedTokens.xsrf;
          if (data.extractedTokens.userName) {
            updates.hhUserName = data.extractedTokens.userName;
          }
          if (data.extractedTokens.userEmail) {
            updates.hhUserEmail = data.extractedTokens.userEmail;
          }
          if (onTokensExtracted) {
            onTokensExtracted(data.extractedTokens);
          }
        }

        if (Object.keys(updates).length > 0) {
          onUpdate(resumeId, updates);
        }

        if (data.status === 'completed' || data.status === 'error') {
          pollingRef.current = false;
          onComplete();
          return;
        }

        setTimeout(pollProgress, 500);
      } catch (error) {
        console.error('Polling error:', error);
        setTimeout(pollProgress, 1000);
      }
    };

    pollProgress();
  }, [resumeId, vacancyCount, onUpdate, onComplete, onTokensExtracted]);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
  }, []);

  return { startPolling, stopPolling };
}
