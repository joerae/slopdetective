import type { SlopAnalysis, PatternDefinition, PatternMatch } from "../types";

interface AnalyzeResponse {
  analysis?: SlopAnalysis;
  error?: string;
  code?: string;
  retryable?: boolean;
  requestId?: string;
}

export class AnalysisRequestError extends Error {
  requestId?: string;
  status?: number;
  statusText?: string;
  code?: string;
  retryable?: boolean;
  endpoint?: string;
  durationMs?: number;
  responseParseError?: string;
  responseBodySnippet?: string;

  constructor(
    message: string,
    options: {
      requestId?: string;
      status?: number;
      statusText?: string;
      code?: string;
      retryable?: boolean;
      endpoint?: string;
      durationMs?: number;
      responseParseError?: string;
      responseBodySnippet?: string;
    } = {}
  ) {
    super(message);
    this.name = "AnalysisRequestError";
    this.requestId = options.requestId;
    this.status = options.status;
    this.statusText = options.statusText;
    this.code = options.code;
    this.retryable = options.retryable;
    this.endpoint = options.endpoint;
    this.durationMs = options.durationMs;
    this.responseParseError = options.responseParseError;
    this.responseBodySnippet = options.responseBodySnippet;
  }
}

// Internal function to calculate score deterministically using custom weights
export const calculateCalculatedSlopScore = (matches: PatternMatch[], activePatterns: PatternDefinition[]): number => {
  let weightedSum = 0;

  matches.forEach(match => {
    // Find definition to get the weight
    const patternDef = activePatterns.find(p => p.id === match.patternId);
    const weight = patternDef ? patternDef.weight : 1.0;
    weightedSum += (match.score * weight);
  });

  // Lower divisor = Higher scores.
  const NORMALIZATION_DIVISOR = 3.0;
  const finalScore = Math.min(100, Math.round(weightedSum / NORMALIZATION_DIVISOR));

  // Return precise score (nearest 1), do NOT round to nearest 10
  return finalScore;
};

export const getWritingStyle = (score: number): 'Human' | 'Hybrid' | 'AI-Heavy' | 'Fully Synthetic' => {
  if (score >= 65) return 'Fully Synthetic';
  if (score >= 40) return 'AI-Heavy';
  if (score >= 20) return 'Hybrid';
  return 'Human';
};

export const analyzeTextForSlop = async (text: string, patterns: PatternDefinition[]): Promise<SlopAnalysis> => {
  const endpoint = "/.netlify/functions/analyze";
  const startedAt = performance.now();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, patterns }),
    });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : "Network request failed.";

    throw new AnalysisRequestError(`Analysis request could not reach the server: ${message}`, {
      endpoint,
      durationMs,
      responseParseError: error instanceof Error ? error.name : undefined,
    });
  }

  const responseText = await response.text();
  const durationMs = Math.round(performance.now() - startedAt);

  let payload: AnalyzeResponse = {};
  let responseParseError: string | undefined;
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    responseParseError = error instanceof Error ? error.message : "Response was not valid JSON.";
  }

  if (!response.ok || !payload.analysis) {
    const fallbackMessage = response.ok ? "Analysis response was empty." : "Analysis failed. Please try again later.";
    const message = payload.error || fallbackMessage;
    const suffix = payload.requestId ? ` Reference: ${payload.requestId}` : "";

    throw new AnalysisRequestError(`${message}${suffix}`, {
      requestId: payload.requestId,
      status: response.status,
      statusText: response.statusText,
      code: payload.code,
      retryable: payload.retryable,
      endpoint,
      durationMs,
      responseParseError,
      responseBodySnippet: responseText.slice(0, 500),
    });
  }

  return payload.analysis;
};
