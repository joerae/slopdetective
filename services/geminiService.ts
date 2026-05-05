
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SlopAnalysis, PatternMatch, PatternDefinition } from "../types";

// Dynamically build the schema based on our strict typescript types
const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    // Note: slopScore is calculated post-process, but we ask for it as a fallback/sanity check
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
            description: "Direct quotes from the text that exhibit the pattern." 
          },
          explanation: { type: Type.STRING, description: "Quantitative note including exact density. Format: 'X instances detected (Y per 1,000 words)'." }
        },
        required: ["patternId", "name", "score", "evidence", "explanation"]
      }
    }
  },
  required: ["slopScore", "verdict", "writingStyle", "patternMatches"]
};

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

// Helper to backfill any missing patterns with 0 score
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
        explanation: "No indicators detected."
      });
    }
  });
  return completeList;
};

export const analyzeTextForSlop = async (text: string, patterns: PatternDefinition[]): Promise<SlopAnalysis> => {
  try {
    // Initialize client inside the function to ensure process.env is ready and avoid 401s
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const patternInstructions = patterns.map(p => {
      // The Speed Limit Formula:
      // "User Tolerance is set to {t} instances per 1,000 words.
      // Score = (Density / {t}) * 50. Cap at 100."
      const t = p.defaultTolerance;
      const toleranceInstruction = `SCORING RULE: User Tolerance is set to **${t} instances per 1,000 words**. Calculate the density of this pattern ($D$). Your Score MUST be calculated as: ($D$ / ${t}) * 50. Cap at 100. Round result to nearest 10.`;

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
      ${text.substring(0, 25000)}
      """
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0, // Deterministic results
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    
    const data = JSON.parse(jsonText) as SlopAnalysis;
    
    if (data.patternMatches) {
        // Backfill missing patterns with 0 score to ensure UI consistency
        data.patternMatches = backfillMatches(data.patternMatches, patterns);

        // Sort by score so high severity items are first
        data.patternMatches.sort((a, b) => b.score - a.score);
        
        // Recalculate score deterministically with ACTIVE PATTERNS
        const calculatedScore = calculateCalculatedSlopScore(data.patternMatches, patterns);
        data.slopScore = calculatedScore;
        
        // Update classification based on strict thresholds
        data.writingStyle = getWritingStyle(data.slopScore);
        
        // Add word count metadata
        data.wordCount = text.trim().split(/\s+/).length;
    }
    
    return data;

  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};
