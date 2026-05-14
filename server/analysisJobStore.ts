import { connectLambda, getStore } from "@netlify/blobs";
import { ANALYSIS_JOB_RETENTION_DAYS, type AnalysisJobRecord } from "../shared/analysisJobs";

const ANALYSIS_JOB_STORE_NAME = "slop-analysis-jobs";
const ANALYSIS_JOB_CLEANUP_STATE_KEY = "maintenance/cleanup-state";
const ANALYSIS_JOB_CLEANUP_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

const getJobKey = (jobId: string) => `jobs/${jobId}`;

export const getAnalysisJobStore = (event: any) => {
  connectLambda(event);
  return getStore(ANALYSIS_JOB_STORE_NAME);
};

export const readAnalysisJob = async (store: ReturnType<typeof getStore>, jobId: string): Promise<AnalysisJobRecord | null> => {
  return await store.get(getJobKey(jobId), { type: "json" }) as AnalysisJobRecord | null;
};

export const writeAnalysisJob = async (store: ReturnType<typeof getStore>, job: AnalysisJobRecord) => {
  await store.setJSON(getJobKey(job.id), job);
};

interface AnalysisJobCleanupState {
  lastRunAt: string;
}

export interface AnalysisJobCleanupResult {
  checked: number;
  deleted: number;
  cutoff: string;
  skipped: boolean;
}

const parseTimestamp = (value: unknown): number | null => {
  if (typeof value !== "string") return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const cleanupOldAnalysisJobs = async (
  store: ReturnType<typeof getStore>,
  nowMs = Date.now(),
): Promise<AnalysisJobCleanupResult> => {
  const retentionMs = ANALYSIS_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoffMs = nowMs - retentionMs;
  const cutoff = new Date(cutoffMs).toISOString();
  const { blobs } = await store.list({ prefix: "jobs/" });
  let deleted = 0;

  for (const blob of blobs) {
    const job = await store.get(blob.key, { type: "json" }) as AnalysisJobRecord | null;
    const timestamp = parseTimestamp(job?.createdAt) ?? parseTimestamp(job?.updatedAt);

    if (timestamp !== null && timestamp < cutoffMs) {
      await store.delete(blob.key);
      deleted += 1;
    }
  }

  return {
    checked: blobs.length,
    deleted,
    cutoff,
    skipped: false,
  };
};

export const cleanupOldAnalysisJobsIfDue = async (
  store: ReturnType<typeof getStore>,
  nowMs = Date.now(),
): Promise<AnalysisJobCleanupResult> => {
  const state = await store.get(ANALYSIS_JOB_CLEANUP_STATE_KEY, { type: "json" }) as AnalysisJobCleanupState | null;
  const lastRunMs = parseTimestamp(state?.lastRunAt);
  const cutoff = new Date(nowMs - ANALYSIS_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  if (lastRunMs !== null && nowMs - lastRunMs < ANALYSIS_JOB_CLEANUP_MIN_INTERVAL_MS) {
    return {
      checked: 0,
      deleted: 0,
      cutoff,
      skipped: true,
    };
  }

  const result = await cleanupOldAnalysisJobs(store, nowMs);
  await store.setJSON(ANALYSIS_JOB_CLEANUP_STATE_KEY, {
    lastRunAt: new Date(nowMs).toISOString(),
  } satisfies AnalysisJobCleanupState);

  return result;
};
