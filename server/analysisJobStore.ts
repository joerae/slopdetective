import { connectLambda, getStore } from "@netlify/blobs";
import type { AnalysisJobRecord } from "../shared/analysisJobs";

const ANALYSIS_JOB_STORE_NAME = "slop-analysis-jobs";

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
