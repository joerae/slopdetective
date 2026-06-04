export interface GeminiModelPreset {
  id: string;
  label: string;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export const GEMINI_MODEL_PRESETS: GeminiModelPreset[] = [
  {
    id: DEFAULT_GEMINI_MODEL,
    label: "Gemini 3.1 Flash-Lite",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
  },
];

export const GEMINI_MODEL = DEFAULT_GEMINI_MODEL;

export const normalizeGeminiModelName = (model: unknown): string => {
  if (typeof model !== "string") return DEFAULT_GEMINI_MODEL;

  const trimmed = model.trim();
  if (!trimmed) return DEFAULT_GEMINI_MODEL;

  return trimmed.replace(/^models\//, "") || DEFAULT_GEMINI_MODEL;
};

export const getGeminiModelLabel = (model: string): string => {
  const normalizedModel = normalizeGeminiModelName(model);
  const preset = GEMINI_MODEL_PRESETS.find(option => option.id === normalizedModel);

  return preset?.label || normalizedModel;
};

export const GEMINI_MODEL_LABEL = getGeminiModelLabel(GEMINI_MODEL);
