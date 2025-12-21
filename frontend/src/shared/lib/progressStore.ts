// Хранилище прогресса в памяти (глобальное)
// @ts-ignore
if (!global.progressStore) {
  // @ts-ignore
  global.progressStore = new Map<string, any>();
}

// @ts-ignore
const progressStore: Map<string, any> = global.progressStore;

export function getProgress(resumeId: string) {
  return progressStore.get(resumeId);
}

export function updateProgress(resumeId: string, updates: any) {
  const current = progressStore.get(resumeId) || {};
  const updated = { ...current, ...updates };
  progressStore.set(resumeId, updated);
  console.log(`[ProgressStore] Updated progress for ${resumeId}:`, JSON.stringify(updated).substring(0, 200));
}

export function clearProgress(resumeId: string) {
  progressStore.delete(resumeId);
  console.log(`[ProgressStore] Cleared progress for ${resumeId}`);
}

export { progressStore };
