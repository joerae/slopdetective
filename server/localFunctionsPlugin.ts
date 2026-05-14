import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { analyzeTextForSlopServer } from "./slopAnalyzer";
import { classifyAnalysisError } from "./analysisErrors";
import { createRequestId, logError, logInfo, logWarn } from "./logger";
import { GEMINI_MODEL } from "../shared/geminiModel";
import { ANALYSIS_BACKGROUND_GEMINI_TIMEOUT_MS, truncateAnalysisInput } from "../shared/analysisLimits";
import {
  ANALYSIS_JOB_RETENTION_DAYS,
  ANALYSIS_JOB_POLL_INTERVAL_MS,
  type AnalysisJobRecord,
} from "../shared/analysisJobs";

const MAX_BODY_SIZE = 1_000_000;

const readJsonBody = async (request: IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", chunk => {
      body += chunk;

      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
};

const sendJson = (response: ServerResponse, statusCode: number, payload: Record<string, unknown>) => {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
};

const localAnalysisJobs = new Map<string, AnalysisJobRecord>();

const cleanupLocalAnalysisJobs = () => {
  const cutoffMs = Date.now() - ANALYSIS_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  localAnalysisJobs.forEach((job, jobId) => {
    const timestamp = Date.parse(job.createdAt || job.updatedAt);

    if (Number.isFinite(timestamp) && timestamp < cutoffMs) {
      localAnalysisJobs.delete(jobId);
      deleted += 1;
    }
  });

  return {
    checked: localAnalysisJobs.size + deleted,
    deleted,
    cutoff: new Date(cutoffMs).toISOString(),
  };
};

const updateLocalAnalysisJob = (jobId: string, update: Partial<AnalysisJobRecord>) => {
  const existing = localAnalysisJobs.get(jobId);
  if (!existing) {
    throw new Error(`Analysis job ${jobId} was not found.`);
  }

  const nextJob: AnalysisJobRecord = {
    ...existing,
    ...update,
    updatedAt: new Date().toISOString(),
  };

  localAnalysisJobs.set(jobId, nextJob);
  return nextJob;
};

const runLocalAnalysisJob = async ({
  jobId,
  requestId,
  text,
  patterns,
  apiKey,
}: {
  jobId: string;
  requestId: string;
  text: string;
  patterns: any[];
  apiKey?: string;
}) => {
  const startedAt = Date.now();

  try {
    updateLocalAnalysisJob(jobId, {
      status: "processing",
    });

    logInfo("analysis_background_started", {
      requestId,
      jobId,
      textLength: text.length,
      patternCount: patterns.length,
      model: GEMINI_MODEL,
      timeoutMs: ANALYSIS_BACKGROUND_GEMINI_TIMEOUT_MS,
      runtime: "vite-dev",
    });

    const analysis = await analyzeTextForSlopServer({
      text,
      patterns,
      apiKey,
      timeoutMs: ANALYSIS_BACKGROUND_GEMINI_TIMEOUT_MS,
    });

    updateLocalAnalysisJob(jobId, {
      status: "complete",
      analysis,
    });

    logInfo("analysis_background_completed", {
      requestId,
      jobId,
      durationMs: Date.now() - startedAt,
      wordCount: analysis.wordCount,
      slopScore: analysis.slopScore,
      patternCount: analysis.patternMatches.length,
      runtime: "vite-dev",
    });
  } catch (error) {
    const failure = classifyAnalysisError(error);

    try {
      updateLocalAnalysisJob(jobId, {
        status: "failed",
        error: failure.publicMessage,
        code: failure.errorCode,
        retryable: failure.retryable,
      });
    } catch (jobUpdateError) {
      logError("analysis_background_job_update_failed", {
        requestId,
        jobId,
        runtime: "vite-dev",
        error: jobUpdateError,
      });
    }

    logError("analysis_background_failed", {
      requestId,
      jobId,
      durationMs: Date.now() - startedAt,
      model: GEMINI_MODEL,
      errorCode: failure.errorCode,
      statusCode: failure.statusCode,
      retryable: failure.retryable,
      runtime: "vite-dev",
      error,
    });
  }
};

export const createLocalFunctionsPlugin = (apiKey?: string): Plugin => ({
  name: "local-netlify-functions",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const pathname = request.url?.split("?")[0];

      if (pathname === "/.netlify/functions/analyze") {
        const requestId = createRequestId();
        const startedAt = Date.now();

        if (request.method !== "POST") {
          logWarn("analysis_method_not_allowed", {
            requestId,
            method: request.method,
            runtime: "vite-dev",
          });
          sendJson(response, 405, { error: "Method not allowed.", requestId });
          return;
        }

        try {
          const body = await readJsonBody(request);
          const text = typeof body.text === "string" ? body.text : "";
          const patterns = Array.isArray(body.patterns) ? body.patterns : [];
          const jobId = createRequestId();

          logInfo("analysis_started", {
            requestId,
            jobId,
            textLength: text.length,
            patternCount: patterns.length,
            model: GEMINI_MODEL,
            runtime: "vite-dev",
          });

          if (!text.trim()) {
            sendJson(response, 400, {
              error: "No text was provided for analysis.",
              code: "invalid_request",
              retryable: false,
              requestId,
            });
            return;
          }

          if (!patterns.length) {
            sendJson(response, 400, {
              error: "No detection patterns were provided.",
              code: "invalid_request",
              retryable: false,
              requestId,
            });
            return;
          }

          const cleanup = cleanupLocalAnalysisJobs();
          if (cleanup.deleted > 0) {
            logInfo("analysis_blob_cleanup_completed", {
              requestId,
              checked: cleanup.checked,
              deleted: cleanup.deleted,
              cutoff: cleanup.cutoff,
              runtime: "vite-dev",
            });
          }

          const now = new Date().toISOString();
          const analysisText = truncateAnalysisInput(text).text;
          localAnalysisJobs.set(jobId, {
            id: jobId,
            status: "queued",
            createdAt: now,
            updatedAt: now,
            requestId,
            textLength: text.length,
            patternCount: patterns.length,
            model: GEMINI_MODEL,
            inputText: analysisText,
            patterns,
          });

          void runLocalAnalysisJob({
            jobId,
            requestId,
            text,
            patterns,
            apiKey,
          });

          logInfo("analysis_queued", {
            requestId,
            jobId,
            durationMs: Date.now() - startedAt,
            runtime: "vite-dev",
          });

          sendJson(response, 202, {
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
            runtime: "vite-dev",
            error,
          });

          sendJson(response, failure.statusCode, {
            error: failure.publicMessage,
            code: failure.errorCode,
            retryable: failure.retryable,
            requestId,
          });
        }

        return;
      }

      if (pathname === "/.netlify/functions/analyze-status") {
        const requestId = createRequestId();

        if (request.method !== "GET") {
          sendJson(response, 405, { error: "Method not allowed.", requestId });
          return;
        }

        const url = new URL(request.url || "", "http://localhost");
        const jobId = url.searchParams.get("jobId");

        if (!jobId) {
          sendJson(response, 400, {
            error: "Missing analysis job id.",
            code: "invalid_request",
            retryable: false,
            requestId,
          });
          return;
        }

        const job = localAnalysisJobs.get(jobId);
        if (!job) {
          sendJson(response, 404, {
            error: "Analysis job was not found.",
            code: "analysis_job_not_found",
            retryable: false,
            requestId,
          });
          return;
        }

        if (job.status === "complete") {
          sendJson(response, 200, {
            jobId: job.id,
            status: job.status,
            requestId: job.requestId,
            analysis: job.analysis,
            inputText: job.inputText,
            patterns: job.patterns,
          });
          return;
        }

        if (job.status === "failed") {
          sendJson(response, 200, {
            jobId: job.id,
            status: job.status,
            requestId: job.requestId,
            error: job.error || "Analysis failed. Please try again later.",
            code: job.code || "analysis_failed",
            retryable: job.retryable !== false,
          });
          return;
        }

        sendJson(response, 200, {
          jobId: job.id,
          status: job.status,
          requestId: job.requestId,
          retryAfterMs: ANALYSIS_JOB_POLL_INTERVAL_MS,
        });
        return;
      }

      if (pathname === "/.netlify/functions/cleanup-analysis-blobs") {
        const requestId = createRequestId();

        if (request.method !== "GET" && request.method !== "POST") {
          sendJson(response, 405, { error: "Method not allowed.", requestId });
          return;
        }

        const cleanup = cleanupLocalAnalysisJobs();
        logInfo("analysis_blob_cleanup_completed", {
          requestId,
          checked: cleanup.checked,
          deleted: cleanup.deleted,
          cutoff: cleanup.cutoff,
          runtime: "vite-dev",
        });

        sendJson(response, 200, {
          ok: true,
          ...cleanup,
          skipped: false,
          requestId,
        });
        return;
      }

      if (pathname === "/.netlify/functions/log-error") {
        const requestId = createRequestId();

        if (request.method !== "POST") {
          sendJson(response, 405, { error: "Method not allowed.", requestId });
          return;
        }

        try {
          const body = await readJsonBody(request);

          logError("client_error", {
            requestId,
            runtime: "vite-dev",
            source: body.source,
            name: body.name,
            message: body.message,
            stack: body.stack,
            details: body.details,
            url: body.url,
            userAgent: body.userAgent,
            metadata: body.metadata,
          });

          sendJson(response, 200, { ok: true, requestId });
        } catch (error) {
          logError("client_error_logging_failed", {
            requestId,
            runtime: "vite-dev",
            error,
          });

          sendJson(response, 400, {
            error: "Invalid log payload.",
            requestId,
          });
        }

        return;
      }

      next();
    });
  },
});
