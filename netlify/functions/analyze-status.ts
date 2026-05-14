import { ANALYSIS_JOB_POLL_INTERVAL_MS } from "../../shared/analysisJobs";
import { getAnalysisJobStore, readAnalysisJob } from "../../server/analysisJobStore";
import { createRequestId, logError, logWarn } from "../../server/logger";

const jsonResponse = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(body),
});

export const handler = async (event: any, context: any) => {
  const requestId = context?.awsRequestId || createRequestId();

  if (event.httpMethod !== "GET") {
    logWarn("analysis_status_method_not_allowed", {
      requestId,
      method: event.httpMethod,
    });

    return jsonResponse(405, {
      error: "Method not allowed.",
      requestId,
    });
  }

  try {
    const jobId = event.queryStringParameters?.jobId;
    if (typeof jobId !== "string" || !jobId) {
      return jsonResponse(400, {
        error: "Missing analysis job id.",
        code: "invalid_request",
        retryable: false,
        requestId,
      });
    }

    const store = getAnalysisJobStore(event);
    const job = await readAnalysisJob(store, jobId);

    if (!job) {
      return jsonResponse(404, {
        error: "Analysis job was not found.",
        code: "analysis_job_not_found",
        retryable: false,
        requestId,
      });
    }

    if (job.status === "complete") {
      return jsonResponse(200, {
        jobId: job.id,
        status: job.status,
        requestId: job.requestId,
        analysis: job.analysis,
        inputText: job.inputText,
        patterns: job.patterns,
      });
    }

    if (job.status === "failed") {
      return jsonResponse(200, {
        jobId: job.id,
        status: job.status,
        requestId: job.requestId,
        error: job.error || "Analysis failed. Please try again later.",
        code: job.code || "analysis_failed",
        retryable: job.retryable !== false,
      });
    }

    return jsonResponse(200, {
      jobId: job.id,
      status: job.status,
      requestId: job.requestId,
      retryAfterMs: ANALYSIS_JOB_POLL_INTERVAL_MS,
    });
  } catch (error) {
    logError("analysis_status_failed", {
      requestId,
      error,
    });

    return jsonResponse(500, {
      error: "Could not read analysis status. Please try again later.",
      code: "analysis_failed",
      retryable: true,
      requestId,
    });
  }
};
