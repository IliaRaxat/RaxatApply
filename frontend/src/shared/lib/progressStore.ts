import fs from 'fs';
import path from 'path';

const PROGRESS_FILE = path.join(process.cwd(), '.progress-store.json');

function readStore(): Record<string, any> {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const content = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      const data = JSON.parse(content);
      return data;
    }
  } catch (e) {
    console.error('[ProgressStore] Read error:', e);
  }
  return {};
}

function writeStore(store: Record<string, any>) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('[ProgressStore] Write error:', e);
  }
}

export function getProgress(resumeId: string) {
  const store = readStore();
  const progress = store[resumeId];
  return progress;
}

export function updateProgress(resumeId: string, updates: any) {
  const store = readStore();
  store[resumeId] = { ...store[resumeId], ...updates };
  writeStore(store);
  console.log(`[ProgressStore] Updated ${resumeId}:`, JSON.stringify(store[resumeId]));
}

export function clearProgress(resumeId: string) {
  const store = readStore();
  delete store[resumeId];
  writeStore(store);
  console.log(`[ProgressStore] Cleared ${resumeId}`);
}

export const progressStore = {
  get: (key: string) => readStore()[key],
  set: (key: string, value: any) => { const s = readStore(); s[key] = value; writeStore(s); },
  delete: (key: string) => { const s = readStore(); delete s[key]; writeStore(s); }
};
