declare global {
  var progressStoreGlobal: Map<string, any> | undefined;
}

export const progressStore = global.progressStoreGlobal ?? new Map<string, any>();

if (!global.progressStoreGlobal) {
  global.progressStoreGlobal = progressStore;
}

export function updateProgress(resumeId: string, data: any) {
  progressStore.set(resumeId, data);
}

export function getProgress(resumeId: string) {
  return progressStore.get(resumeId);
}
