import { GoogleGenAI, Type, Schema } from "@google/genai";
import type { SlopAnalysis, PatternDefinition, PatternMatch } from "../types";
import { PublicAnalysisError } from "./analysisErrors";
import { GEMINI_MODEL } from "../shared/geminiModel";
import { truncateAnalysisInput } from "../shared/analysisLimits";

interface AnalyzeInput {
  text: string;
  patterns: PatternDefinition[];
  apiKey?: string;
}

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
          evidence: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Direct quotes from the text that exhibit the pattern.",
          },
          explanation: { type: Type.STRING, description: "Quantitative note including exact density. Format: 'X instances detected (Y per 1,000 words)'." },
        },
        required: ["patternId", "name", "score", "evidence", "explanation"],
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

const backfillMatches = (matches: PatternMatch[], activePatterns: PatternDefinition[]): PatternMatch[] => {
  const existingIds = new Set(matches.map(m => m.patternId));
  const completeList = [...matches];

  activePatterns.forEach(pattern => {
    if (!existingIds.has(pattern.id)) {
      completeList.push({
        patternId: pattern.id,
        name: pattern.name,
        score: 0,
        evidence: [],
        explanation: "No indicators detected.",
      });
    }
  });

  return completeList;
};

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

export const analyzeTextForSlopServer = async ({ text, patterns, apiKey }: AnalyzeInput): Promise<SlopAnalysis> => {
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

  const patternInstructions = patterns.map(p => {
    const tolerance = p.defaultTolerance;
    const toleranceInstruction = `SCORING RULE: User Tolerance is set to **${tolerance} instances per 1,000 words**. Calculate the density of this pattern ($D$). Your Score MUST be calculated as: ($D$ / ${tolerance}) * 50. Cap at 100. Round result to nearest 10.`;

    return `ID: "${p.id}"\nNAME: "${p.name}"\nINSTRUCTION: ${p.promptInstruction}\n${toleranceInstruction}`;
  }).join("\n\n");

  const prompt = `
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

      Analyze the text against the following patterns. For EACH pattern, provide a score (0-100) and evidence.

      --- START PATTERNS ---
      ${patternInstructions}
      --- END PATTERNS ---

      Text to analyze:
      """
      ${analysisText}
      """
    `;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA,
      temperature: 0,
    },
  });

  const jsonText = response.text;
  if (!jsonText) {
    throw new PublicAnalysisError("No response from Gemini.", {
      errorCode: "gemini_bad_response",
      publicMessage: "Gemini returned an empty response. Please try again.",
      statusCode: 502,
      retryable: true,
    });
  }

  let data: SlopAnalysis;
  try {
    data = JSON.parse(jsonText) as SlopAnalysis;
  } catch (error) {
    throw new PublicAnalysisError(error instanceof Error ? error.message : "Gemini returned invalid JSON.", {
      errorCode: "gemini_bad_response",
      publicMessage: "Gemini returned an unreadable response. Please try again.",
      statusCode: 502,
      retryable: true,
    });
  }

  if (data.patternMatches) {
    data.patternMatches = backfillMatches(data.patternMatches, patterns);
    data.patternMatches.sort((a, b) => b.score - a.score);

    data.slopScore = calculateCalculatedSlopScore(data.patternMatches, patterns);
    data.writingStyle = getWritingStyle(data.slopScore);
    data.wordCount = countWords(analysisText);
  }

  return data;
};
