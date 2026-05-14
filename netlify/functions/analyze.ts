import { classifyAnalysisError } from "../../server/analysisErrors";
import { createRequestId, logError, logInfo, logWarn } from "../../server/logger";
import { GEMINI_MODEL } from "../../shared/geminiModel";
import { ANALYSIS_JOB_POLL_INTERVAL_MS, type AnalysisJobRecord } from "../../shared/analysisJobs";
import { getAnalysisJobStore, writeAnalysisJob } from "../../server/analysisJobStore";
import { ANALYSIS_JOB_TOKEN_HEADER, createAnalysisJobToken } from "../../server/analysisJobAuth";

const jsonResponse = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const safeParseBody = (body: string | null) => {
  if (!body) return {};
  return JSON.parse(body);
};

const readHeader = (headers: Record<string, string | undefined> | undefined, headerName: string): string | undefined => {
  if (!headers) return undefined;

  return Object.entries(headers).find(([key]) => key.toLowerCase() === headerName.toLowerCase())?.[1];
};

const getFunctionOrigin = (event: any): string => {
  const host = readHeader(event.headers, "host");
  if (host) {
    const protocol = readHeader(event.headers, "x-forwarded-proto") || "https";
    return `${protocol.split(",")[0]}://${host}`;
  }

  if (process.env.URL) return process.env.URL;

  throw new Error("Could not determine site URL for background analysis job.");
};

export const handler = async (event: any, context: any) => {
  const requestId = context?.awsRequestId || createRequestId();
  const startedAt = Date.now();

  if (event.httpMethod !== "POST") {
    logWarn("analysis_method_not_allowed", {
      requestId,
      method: event.httpMethod,
    });

    return jsonResponse(405, {
      error: "Method not allowed.",
      requestId,
    });
  }

  try {
    const body = safeParseBody(event.body);
    const text = typeof body.text === "string" ? body.text : "";
    const patterns = Array.isArray(body.patterns) ? body.patterns : [];
    const jobId = createRequestId();

    logInfo("analysis_started", {
      requestId,
      jobId,
      textLength: text.length,
      patternCount: patterns.length,
      model: GEMINI_MODEL,
      deployContext: process.env.CONTEXT,
      siteName: process.env.SITE_NAME,
    });

    if (!text.trim()) {
      return jsonResponse(400, {
        error: "No text was provided for analysis.",
        code: "invalid_request",
        retryable: false,
        requestId,
      });
    }

    if (!patterns.length) {
      return jsonResponse(400, {
        error: "No detection patterns were provided.",
        code: "invalid_request",
        retryable: false,
        requestId,
      });
    }

    const now = new Date().toISOString();
    const job: AnalysisJobRecord = {
      id: jobId,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      requestId,
      textLength: text.length,
      patternCount: patterns.length,
      model: GEMINI_MODEL,
    };

    const store = getAnalysisJobStore(event);
    await writeAnalysisJob(store, job);

    const backgroundUrl = `${getFunctionOrigin(event)}/.netlify/functions/analyze-background`;
    const backgroundResponse = await fetch(backgroundUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [ANALYSIS_JOB_TOKEN_HEADER]: createAnalysisJobToken(),
      },
      body: JSON.stringify({
        jobId,
        requestId,
        text,
        patterns,
      }),
    });

    if (!backgroundResponse.ok && backgroundResponse.status !== 202) {
      const failureJob: AnalysisJobRecord = {
        ...job,
        status: "failed",
        updatedAt: new Date().toISOString(),
        error: "Analysis worker could not be started. Please try again later.",
        code: "analysis_failed",
        retryable: true,
      };
      await writeAnalysisJob(store, failureJob);

      throw new Error(`Background analysis worker returned ${backgroundResponse.status}.`);
    }

    logInfo("analysis_queued", {
      requestId,
      jobId,
      durationMs: Date.now() - startedAt,
      backgroundStatus: backgroundResponse.status,
    });

    return jsonResponse(202, {
      jobId,
      status: "queued",
      statusUrl: `/.netlify/functions/analyze-status?jobId=${encodeURIComponent(jobId)}`,
      retryAfterMs: ANALYSIS_JOB_POLL_INTERVAL_MS,
      requestId,
    });
  } catch (error) {
    const failure = classifyAnalysisError(error);

    logError("analysis_failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      model: GEMINI_MODEL,
      errorCode: failure.errorCode,
      statusCode: failure.statusCode,
      retryable: failure.retryable,
      error,
    });

    return jsonResponse(failure.statusCode, {
      error: failure.publicMessage,
      code: failure.errorCode,
      retryable: failure.retryable,
      requestId,
    });
  }
};
