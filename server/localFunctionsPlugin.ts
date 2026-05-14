import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { analyzeTextForSlopServer } from "./slopAnalyzer";
import { classifyAnalysisError } from "./analysisErrors";
import { createRequestId, logError, logInfo, logWarn } from "./logger";
import { GEMINI_MODEL } from "../shared/geminiModel";

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

          logInfo("analysis_started", {
            requestId,
            textLength: text.length,
            patternCount: patterns.length,
            model: GEMINI_MODEL,
            runtime: "vite-dev",
          });

          const analysis = await analyzeTextForSlopServer({
            text,
            patterns,
            apiKey,
          });

          logInfo("analysis_completed", {
            requestId,
            durationMs: Date.now() - startedAt,
            wordCount: analysis.wordCount,
            slopScore: analysis.slopScore,
            patternCount: analysis.patternMatches.length,
            runtime: "vite-dev",
          });

          sendJson(response, 200, { analysis, requestId });
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
