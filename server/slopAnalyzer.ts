import { GoogleGenAI, Type, Schema } from "@google/genai";
import type { SlopAnalysis, PatternDefinition, PatternMatch } from "../types";
import { classifyAnalysisError, PublicAnalysisError } from "./analysisErrors";
import { GEMINI_MODEL } from "../shared/geminiModel";
import { ANALYSIS_GEMINI_MAX_OUTPUT_TOKENS, ANALYSIS_GEMINI_TIMEOUT_MS, truncateAnalysisInput } from "../shared/analysisLimits";

interface AnalyzeInput {
  text: string;
  patterns: PatternDefinition[];
  apiKey?: string;
  timeoutMs?: number;
}

const ANALYSIS_PATTERN_CHUNK_SIZE = 4;
const ANALYSIS_MAX_PARALLEL_REQUESTS = 2;
const ANALYSIS_GEMINI_MAX_ATTEMPTS = 2;

// Dynamically build the schema based on our strict typescript types.
const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    // Note: slopScore is calculated post-process, but we ask for it as a fallback/sanity check.
    slopScore: { type: Type.NUMBER, description: "0-100 indicating density of AI patterns." },
    verdict: { type: Type.STRING, description: "A neutral, evidence-based summary (5-10 words)." },
    writingStyle: { type: Type.STRING, enum: ['Human', 'Hybrid', 'AI-Heavy', 'Fully Synthetic'] },
    patternMatches: {
      type: Type.ARRAY,
      description: "Detailed analysis of each detection pattern.",
      items: {
        type: Type.OBJECT,
        properties: {
          patternId: { type: Type.STRING, description: "Must match the ID provided in the prompt instructions." },
          name: { type: Type.STRING, description: "Name of the pattern found." },
          score: { type: Type.NUMBER, description: "0-100 severity based on calculated DENSITY formula. ROUND TO NEAREST 10." },
          instanceCount: {
            type: Type.NUMBER,
            description: "Total number of detected instances for this pattern, including instances not included in the evidence samples.",
          },
          evidence: {
            type: Type.ARRAY,
            maxItems: "24",
            items: {
              type: Type.STRING,
              maxLength: "240",
            },
            description: "Direct quotes from the text that exhibit the pattern.",
          },
          explanation: { type: Type.STRING, description: "Quantitative note including exact density. Format: 'X instances detected (Y per 1,000 words)'." },
        },
        required: ["patternId", "name", "score", "instanceCount", "evidence", "explanation"],
      },
    },
  },
  required: ["slopScore", "verdict", "writingStyle", "patternMatches"],
};

export const calculateCalculatedSlopScore = (matches: PatternMatch[], activePatterns: PatternDefinition[]): number => {
  let weightedSum = 0;

  matches.forEach(match => {
    const patternDef = activePatterns.find(p => p.id === match.patternId);
    const weight = patternDef ? patternDef.weight : 1.0;
    weightedSum += match.score * weight;
  });

  const NORMALIZATION_DIVISOR = 3.0;
  return Math.min(100, Math.round(weightedSum / NORMALIZATION_DIVISOR));
};

export const getWritingStyle = (score: number): 'Human' | 'Hybrid' | 'AI-Heavy' | 'Fully Synthetic' => {
  if (score >= 65) return 'Fully Synthetic';
  if (score >= 40) return 'AI-Heavy';
  if (score >= 20) return 'Hybrid';
  return 'Human';
};

const calculatePatternScore = (instanceCount: number, wordCount: number, tolerance: number): number => {
  if (instanceCount <= 0 || wordCount <= 0 || tolerance <= 0) return 0;

  const density = (instanceCount / wordCount) * 1000;
  const rawScore = (density / tolerance) * 50;
  const roundedToNearestTen = Math.round(rawScore / 10) * 10;

  return Math.min(100, roundedToNearestTen);
};

const formatPatternExplanation = (instanceCount: number, wordCount: number): string => {
  const density = wordCount > 0 ? (instanceCount / wordCount) * 1000 : 0;
  return `${instanceCount} instances detected (${density.toFixed(2)} per 1,000 words)`;
};

const sanitizeInstanceCount = (match: PatternMatch): number => {
  if (typeof match.instanceCount === "number" && Number.isFinite(match.instanceCount)) {
    return Math.max(0, Math.round(match.instanceCount));
  }

  return match.evidence?.length || 0;
};

const backfillMatches = (matches: PatternMatch[], activePatterns: PatternDefinition[], wordCount: number): PatternMatch[] => {
  const matchByPatternId = new Map<string, PatternMatch>();
  matches.forEach(match => {
    if (typeof match.patternId === "string" && !matchByPatternId.has(match.patternId)) {
      matchByPatternId.set(match.patternId, match);
    }
  });

  return activePatterns.map(pattern => {
    const match = matchByPatternId.get(pattern.id);

    if (!match) {
      return {
        patternId: pattern.id,
        name: pattern.name,
        score: 0,
        instanceCount: 0,
        evidence: [],
        explanation: "No indicators detected.",
      };
    }

    const instanceCount = sanitizeInstanceCount(match);

    return {
      ...match,
      patternId: pattern.id,
      name: pattern.name,
      instanceCount,
      evidence: Array.isArray(match.evidence) ? match.evidence : [],
      score: calculatePatternScore(instanceCount, wordCount, pattern?.defaultTolerance || 1),
      explanation: formatPatternExplanation(instanceCount, wordCount),
    };
  });
};

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

const createTimeoutController = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
};

const sleep = (durationMs: number) => new Promise(resolve => setTimeout(resolve, durationMs));

const getFinishReason = (response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>): string | undefined => {
  return response.candidates?.[0]?.finishReason;
};

const getUsageSummary = (response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>) => {
  const usage = response.usageMetadata;

  return usage
    ? `prompt=${usage.promptTokenCount ?? "unknown"}, candidates=${usage.candidatesTokenCount ?? "unknown"}, thoughts=${usage.thoughtsTokenCount ?? "unknown"}, total=${usage.totalTokenCount ?? "unknown"}`
    : "usage=unavailable";
};

const buildAnalysisPrompt = (analysisText: string, patterns: PatternDefinition[]) => {
  const patternInstructions = patterns.map(p => {
    const tolerance = p.defaultTolerance;
    const toleranceInstruction = `SCORING RULE: User Tolerance is set to **${tolerance} instances per 1,000 words**. Calculate the density of this pattern ($D$). Your Score MUST be calculated as: ($D$ / ${tolerance}) * 50. Cap at 100. Round result to nearest 10.`;

    return `ID: "${p.id}"\nNAME: "${p.name}"\nINSTRUCTION: ${p.promptInstruction}\n${toleranceInstruction}`;
  }).join("\n\n");

  return `
      You are a **Forensic Text Analyst**. Your job is to objectively quantify linguistic patterns common in Large Language Models (LLMs).

      **CRITICAL STYLE RULES:**
      1. **Tone:** Neutral, scientific, and data-driven. Avoid judgmental words.
      2. **Phrasing:** Use "High frequency observed" or "Patterns consistent with synthetic generation."
      3. **Explanations:** MUST follow the format: "X instances detected (Y per 1,000 words)".
      4. **Caricature Mimicry:** Watch out for text that tries too hard to have a "Voice".
      5. **ROUNDING:** ROUND ALL SCORES TO THE NEAREST 10 (e.g. 0, 10, 20... 90, 100).

      **DENSITY IS KEY:**
      - **Do not score based on raw counts alone.**
      - Always calculate the density (instances per 1000 words) before scoring.
      - **RESPECT THE SCORING RULE provided for each pattern.**
      - Ignore any hardcoded scoring rules inside the INSTRUCTION text (like "Score High if found"). Only use the SCORING RULE formula.
      - If no rule is provided, use common sense: High Density = High Score.

      Analyze the text against the following patterns. For EACH pattern:
      - Count every instance in instanceCount, even if there are more than the returned evidence samples.
      - Return up to 24 evidence quotes as samples for highlighting and review.
      - Keep each quote under 20 words.

      --- START PATTERNS ---
      ${patternInstructions}
      --- END PATTERNS ---

      Text to analyze:
      """
      ${analysisText}
      """
    `;
};

const parseAnalysisResponse = (
  response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>,
): SlopAnalysis => {
  const jsonText = response.text;
  if (!jsonText) {
    throw new PublicAnalysisError("No response from Gemini.", {
      errorCode: "gemini_bad_response",
      publicMessage: "Gemini returned an empty response. Please try again.",
      statusCode: 502,
      retryable: true,
    });
  }

  try {
    return JSON.parse(jsonText) as SlopAnalysis;
  } catch (error) {
    const finishReason = getFinishReason(response);
    const usageSummary = getUsageSummary(response);
    const parseMessage = error instanceof Error ? error.message : "Gemini returned invalid JSON.";
    const diagnosticMessage =
      finishReason === "MAX_TOKENS"
        ? `${parseMessage} Gemini stopped at maxOutputTokens=${ANALYSIS_GEMINI_MAX_OUTPUT_TOKENS}. ${usageSummary}.`
        : `${parseMessage} Gemini finishReason=${finishReason ?? "unknown"}. ${usageSummary}.`;

    throw new PublicAnalysisError(diagnosticMessage, {
      errorCode: "gemini_bad_response",
      publicMessage:
        finishReason === "MAX_TOKENS"
          ? "Gemini's response was too long to parse. Please try again."
          : "Gemini returned an unreadable response. Please try again.",
      statusCode: 502,
      retryable: true,
    });
  }
};

const requestGeminiAnalysis = async (
  ai: GoogleGenAI,
  analysisText: string,
  patterns: PatternDefinition[],
  timeoutMs: number,
): Promise<SlopAnalysis> => {
  const timeoutController = createTimeoutController(timeoutMs);

  let response;
  try {
    response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildAnalysisPrompt(analysisText, patterns),
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0,
        maxOutputTokens: ANALYSIS_GEMINI_MAX_OUTPUT_TOKENS,
        abortSignal: timeoutController.signal,
        httpOptions: {
          timeout: timeoutMs,
        },
      },
    });
  } finally {
    timeoutController.clear();
  }

  return parseAnalysisResponse(response);
};

const shouldRetryGeminiAnalysis = (error: unknown) => {
  const failure = classifyAnalysisError(error);

  return (
    failure.retryable &&
    failure.errorCode !== "gemini_quota" &&
    (failure.errorCode === "gemini_timeout" ||
      failure.errorCode === "gemini_unavailable" ||
      failure.errorCode === "gemini_bad_response" ||
      failure.errorCode === "analysis_failed")
  );
};

const requestGeminiAnalysisWithRetry = async (
  ai: GoogleGenAI,
  analysisText: string,
  patterns: PatternDefinition[],
  timeoutMs: number,
): Promise<SlopAnalysis> => {
  const attemptTimeoutMs = Math.max(15_000, Math.floor(timeoutMs / ANALYSIS_GEMINI_MAX_ATTEMPTS));
  let lastError: unknown;

  for (let attempt = 1; attempt <= ANALYSIS_GEMINI_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestGeminiAnalysis(ai, analysisText, patterns, attemptTimeoutMs);
    } catch (error) {
      lastError = error;

      if (attempt >= ANALYSIS_GEMINI_MAX_ATTEMPTS || !shouldRetryGeminiAnalysis(error)) {
        throw error;
      }

      await sleep(750 * attempt);
    }
  }

  throw lastError;
};

const chunkPatterns = (patterns: PatternDefinition[]) => {
  const chunks: PatternDefinition[][] = [];

  for (let i = 0; i < patterns.length; i += ANALYSIS_PATTERN_CHUNK_SIZE) {
    chunks.push(patterns.slice(i, i + ANALYSIS_PATTERN_CHUNK_SIZE));
  }

  return chunks;
};

const buildVerdict = (slopScore: number, matches: PatternMatch[]) => {
  const topMatch = matches.find(match => match.score > 0);

  if (!topMatch || slopScore < 20) return "Few synthetic patterns detected.";
  if (slopScore < 40) return `Some synthetic patterns detected: ${topMatch.name}.`;
  if (slopScore < 65) return `Multiple synthetic patterns detected: ${topMatch.name}.`;
  return `High frequency synthetic patterns detected: ${topMatch.name}.`;
};

const mergeAnalyses = (
  analyses: SlopAnalysis[],
  patterns: PatternDefinition[],
  wordCount: number,
): SlopAnalysis => {
  const patternMatches = backfillMatches(
    analyses.flatMap(analysis => analysis.patternMatches || []),
    patterns,
    wordCount,
  );

  patternMatches.sort((a, b) => b.score - a.score);

  const slopScore = calculateCalculatedSlopScore(patternMatches, patterns);

  return {
    slopScore,
    verdict: analyses.length === 1 ? analyses[0].verdict : buildVerdict(slopScore, patternMatches),
    writingStyle: getWritingStyle(slopScore),
    patternMatches,
    wordCount,
  };
};

export const analyzeTextForSlopServer = async ({ text, patterns, apiKey, timeoutMs = ANALYSIS_GEMINI_TIMEOUT_MS }: AnalyzeInput): Promise<SlopAnalysis> => {
  if (!apiKey) {
    throw new PublicAnalysisError("GEMINI_API_KEY is not configured.", {
      errorCode: "missing_api_key",
      publicMessage: "Analysis is not configured correctly. The site owner needs to set GEMINI_API_KEY.",
      statusCode: 500,
      retryable: false,
    });
  }

  if (!text.trim()) {
    throw new PublicAnalysisError("No text was provided for analysis.", {
      errorCode: "invalid_request",
      publicMessage: "No text was provided for analysis.",
      statusCode: 400,
      retryable: false,
    });
  }

  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new PublicAnalysisError("No detection patterns were provided.", {
      errorCode: "invalid_request",
      publicMessage: "No detection patterns were provided.",
      statusCode: 400,
      retryable: false,
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const analysisText = truncateAnalysisInput(text).text;
  const wordCount = countWords(analysisText);
  const patternChunks = chunkPatterns(patterns);
  const analyses: SlopAnalysis[] = [];

  for (let i = 0; i < patternChunks.length; i += ANALYSIS_MAX_PARALLEL_REQUESTS) {
    const batch = patternChunks.slice(i, i + ANALYSIS_MAX_PARALLEL_REQUESTS);
    const batchAnalyses = await Promise.all(
      batch.map(chunk => requestGeminiAnalysisWithRetry(ai, analysisText, chunk, timeoutMs)),
    );

    analyses.push(...batchAnalyses);
  }

  return mergeAnalyses(analyses, patterns, wordCount);
};
