export interface Resume {
  id: string;
  hhtoken: string;
  xsrf: string;
  geminiKey: string;
  status: 'idle' | 'parsing' | 'rating' | 'applying' | 'completed' | 'error';
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
}
