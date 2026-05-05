import type { SlopAnalysis, PatternDefinition, PatternMatch } from "../types";

interface AnalyzeResponse {
  analysis?: SlopAnalysis;
  error?: string;
  requestId?: string;
}

export class AnalysisRequestError extends Error {
  requestId?: string;
  status?: number;

  constructor(message: string, options: { requestId?: string; status?: number } = {}) {
    super(message);
    this.name = "AnalysisRequestError";
    this.requestId = options.requestId;
    this.status = options.status;
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
  const response = await fetch("/.netlify/functions/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, patterns }),
  });

  let payload: AnalyzeResponse = {};
  try {
    payload = await response.json();
  } catch {
    // Leave payload empty; the response status still tells us the request failed.
  }

  if (!response.ok || !payload.analysis) {
    const fallbackMessage = response.ok ? "Analysis response was empty." : "Analysis failed. Please try again later.";
    const message = payload.error || fallbackMessage;
    const suffix = payload.requestId ? ` Reference: ${payload.requestId}` : "";

    throw new AnalysisRequestError(`${message}${suffix}`, {
      requestId: payload.requestId,
      status: response.status,
    });
  }

  return payload.analysis;
};
