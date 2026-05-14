export const ANALYSIS_MAX_INPUT_PAGES = 5;
export const ANALYSIS_MAX_INPUT_CHARS = 15000;
export const ANALYSIS_GEMINI_TIMEOUT_MS = 28000;

export const truncateAnalysisInput = (text: string) => {
  if (text.length <= ANALYSIS_MAX_INPUT_CHARS) {
    return {
      text,
      wasTruncated: false,
      truncatedCharCount: 0,
    };
  }

  return {
    text: text.slice(0, ANALYSIS_MAX_INPUT_CHARS),
    wasTruncated: true,
    truncatedCharCount: text.length - ANALYSIS_MAX_INPUT_CHARS,
  };
};
