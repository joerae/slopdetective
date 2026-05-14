import type { SlopAnalysis } from "../types";

export type AnalysisJobStatus = "queued" | "processing" | "complete" | "failed";

export interface AnalysisJobRecord {
  id: string;
  status: AnalysisJobStatus;
  createdAt: string;
  updatedAt: string;
  requestId: string;
  textLength: number;
  patternCount: number;
  model: string;
  analysis?: SlopAnalysis;
  error?: string;
  code?: string;
  retryable?: boolean;
}

export interface AnalysisJobSubmitResponse {
  jobId: string;
  status: AnalysisJobStatus;
  statusUrl: string;
  retryAfterMs: number;
  requestId: string;
}

export interface AnalysisJobStatusResponse {
  jobId: string;
  status: AnalysisJobStatus;
  retryAfterMs?: number;
  requestId?: string;
  analysis?: SlopAnalysis;
  error?: string;
  code?: string;
  retryable?: boolean;
}

export const ANALYSIS_JOB_POLL_INTERVAL_MS = 2000;
export const ANALYSIS_JOB_CLIENT_TIMEOUT_MS = 180000;
