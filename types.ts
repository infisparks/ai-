export enum AppState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  GATHERING_DETAILS = 'GATHERING_DETAILS',
  DENIED = 'PERMISSIONS_DENIED',
  SCANNING = 'SCANNING',
  ANALYZING = 'ANALYZING',
  GENERATING_REPORT = 'GENERATING_REPORT',
  REPORT = 'REPORT',
  ERROR = 'ERROR',
  POST_REPORT_CONVERSATION = 'POST_REPORT_CONVERSATION',
  GENERATING_PDF = 'GENERATING_PDF',
}

export interface UserData {
  name: string;
  phone: string;
}

export interface SkinIssue {
    issue: string;
    description: string;
}

export interface MedzealRecommendation {
    treatment: string;
    description: string;
}

export interface SkinReport {
  name: string;
  phone: string;
  date: string;
  issues: SkinIssue[];
  recommendations: MedzealRecommendation[];
  summary: string;
}

export interface DetailToVerify {
    type: 'name' | 'phone';
    value: string;
}