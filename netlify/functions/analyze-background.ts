import { analyzeTextForSlopServer } from "../../server/slopAnalyzer";
import { classifyAnalysisError } from "../../server/analysisErrors";
import { hasValidAnalysisJobToken } from "../../server/analysisJobAuth";
import { getAnalysisJobStore, readAnalysisJob, writeAnalysisJob } from "../../server/analysisJobStore";
import { createRequestId, logError, logInfo, logWarn } from "../../server/logger";
import { GEMINI_MODEL } from "../../shared/geminiModel";
import { ANALYSIS_BACKGROUND_GEMINI_TIMEOUT_MS } from "../../shared/analysisLimits";
import type { AnalysisJobRecord } from "../../shared/analysisJobs";

const safeParseBody = (body: string | null) => {
  if (!body) return {};
  return JSON.parse(body);
};

const updateJob = async (event: any, jobId: string, update: Partial<AnalysisJobRecord>) => {
  const store = getAnalysisJobStore(event);
  const existing = await readAnalysisJob(store, jobId);

  if (!existing) {
    throw new Error(`Analysis job ${jobId} was not found.`);
  }

  const nextJob: AnalysisJobRecord = {
    ...existing,
    ...update,
    updatedAt: new Date().toISOString(),
  };

  await writeAnalysisJob(store, nextJob);
  return nextJob;
};

export const handler = async (event: any, context: any) => {
  const workerRequestId = context?.awsRequestId || createRequestId();
  const startedAt = Date.now();

  if (event.httpMethod !== "POST") {
    logWarn("analysis_background_method_not_allowed", {
      requestId: workerRequestId,
      method: event.httpMethod,
    });
    return;
  }

  if (!hasValidAnalysisJobToken(event.headers)) {
    logWarn("analysis_background_unauthorized", {
      requestId: workerRequestId,
    });
    return;
  }

  const body = safeParseBody(event.body);
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : workerRequestId;
  const text = typeof body.text === "string" ? body.text : "";
  const patterns = Array.isArray(body.patterns) ? body.patterns : [];

  try {
    if (!jobId) {
      throw new Error("Background analysis request did not include a jobId.");
    }

    await updateJob(event, jobId, {
      status: "processing",
    });

    logInfo("analysis_background_started", {
      requestId,
      workerRequestId,
      jobId,
      textLength: text.length,
      patternCount: patterns.length,
      model: GEMINI_MODEL,
      timeoutMs: ANALYSIS_BACKGROUND_GEMINI_TIMEOUT_MS,
    });

    const analysis = await analyzeTextForSlopServer({
      text,
      patterns,
      apiKey: process.env.GEMINI_API_KEY,
      timeoutMs: ANALYSIS_BACKGROUND_GEMINI_TIMEOUT_MS,
    });

    await updateJob(event, jobId, {
      status: "complete",
      analysis,
    });

    logInfo("analysis_background_completed", {
      requestId,
      workerRequestId,
      jobId,
      durationMs: Date.now() - startedAt,
      wordCount: analysis.wordCount,
      slopScore: analysis.slopScore,
      patternCount: analysis.patternMatches.length,
    });
  } catch (error) {
    const failure = classifyAnalysisError(error);

    if (jobId) {
      try {
        await updateJob(event, jobId, {
          status: "failed",
          error: failure.publicMessage,
          code: failure.errorCode,
          retryable: failure.retryable,
        });
      } catch (jobUpdateError) {
        logError("analysis_background_job_update_failed", {
          requestId,
          workerRequestId,
          jobId,
          error: jobUpdateError,
        });
      }
    }

    logError("analysis_background_failed", {
      requestId,
      workerRequestId,
      jobId,
      durationMs: Date.now() - startedAt,
      model: GEMINI_MODEL,
      errorCode: failure.errorCode,
      statusCode: failure.statusCode,
      retryable: failure.retryable,
      error,
    });
  }
};
