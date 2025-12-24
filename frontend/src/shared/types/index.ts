export interface Resume {
  id: string;
  hhtoken: string;
  xsrf: string;
  hhUserName?: string;
  hhUserEmail?: string;
  geminiKey: string;
  coverLetter: string;
  status: 'idle' | 'waiting_for_auth' | 'auth_completed' | 'parsing' | 'rating' | 'applying' | 'completed' | 'error';
  progress: {
    parsed: number;
    target: number;
    applied: number;
    successCount?: number;
    failedCount?: number;
    totalCount?: number;
  };
  topVacancies: Vacancy[];
  error?: string;
  hasBrowserProfile?: boolean; // Есть сохранённый профиль браузера (возможно авторизован)
}

export interface Vacancy {
  vacancy_id: number;
  title: string;
  company: string;
  salary?: string;
  link: string;
  relevance_score: number;
  position?: number;
}

export interface StartProcessParams {
  resumeId: string;
  hhtoken: string;
  xsrf: string;
  geminiKey: string;
  coverLetter: string;
  vacancyCount?: number;
}

export interface ProgressData {
  resumeId: string;
  status?: string;
  parsed?: number;
  target?: number;
  applied?: number;
  successCount?: number;
  failedCount?: number;
  totalCount?: number;
  topVacancies?: Vacancy[];
  extractedTokens?: {
    hhtoken: string;
    xsrf: string;
    userName?: string;
    userEmail?: string;
  };
}
