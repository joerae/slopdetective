
export interface PatternDefinition {
  id: string;
  name: string;
  description: string;
  promptInstruction: string; // The specific instruction given to the AI
  weight: number; // Multiplier for score calculation (e.g. 1.0 = standard, 2.0 = critical, 0.5 = minor)
  defaultTolerance: number; // Default instances per 1000 words allowed
}

export interface PatternMatch {
  patternId: string;
  name: string;
  score: number; // 0-100 severity of this specific pattern
  instanceCount?: number; // Total detected instances, which can exceed returned evidence samples
  evidence: string[]; // Sample quotes from the text
  explanation: string; // Brief explanation of why this was flagged
  dismissedCount?: number; // Client-side tracking of user-dismissed items
}

export interface SlopAnalysis {
  slopScore: number; // 0-100 (Calculated)
  verdict: string;
  writingStyle: 'Human' | 'Hybrid' | 'AI-Heavy' | 'Fully Synthetic';
  patternMatches: PatternMatch[]; // Detailed breakdown
  wordCount?: number; // Total words in the analyzed text
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface ResearchItem {
  id: string;
  text: string;
  completed: boolean;
  category: string;
}
