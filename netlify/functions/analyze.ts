import { analyzeTextForSlopServer } from "../../server/slopAnalyzer";
import { createRequestId, logError, logInfo, logWarn } from "../../server/logger";

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

    logInfo("analysis_started", {
      requestId,
      textLength: text.length,
      patternCount: patterns.length,
      deployContext: process.env.CONTEXT,
      siteName: process.env.SITE_NAME,
    });

    const analysis = await analyzeTextForSlopServer({
      text,
      patterns,
      apiKey: process.env.GEMINI_API_KEY,
    });

    logInfo("analysis_completed", {
      requestId,
      durationMs: Date.now() - startedAt,
      wordCount: analysis.wordCount,
      slopScore: analysis.slopScore,
      patternCount: analysis.patternMatches.length,
    });

    return jsonResponse(200, {
      analysis,
      requestId,
    });
  } catch (error) {
    logError("analysis_failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      error,
    });

    return jsonResponse(500, {
      error: "Analysis failed. Please try again later.",
      requestId,
    });
  }
};
