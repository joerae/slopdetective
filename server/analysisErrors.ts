export type AnalysisErrorCode =
  | "missing_api_key"
  | "invalid_request"
  | "gemini_auth"
  | "gemini_quota"
  | "gemini_unavailable"
  | "gemini_timeout"
  | "gemini_bad_response"
  | "analysis_failed";

interface PublicAnalysisErrorOptions {
  errorCode: AnalysisErrorCode;
  publicMessage: string;
  statusCode: number;
  retryable?: boolean;
}

export class PublicAnalysisError extends Error {
  errorCode: AnalysisErrorCode;
  publicMessage: string;
  statusCode: number;
  retryable: boolean;

  constructor(message: string, options: PublicAnalysisErrorOptions) {
    super(message);
    this.name = "PublicAnalysisError";
    this.errorCode = options.errorCode;
    this.publicMessage = options.publicMessage;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
  }
}

interface ClassifiedAnalysisError {
  errorCode: AnalysisErrorCode;
  publicMessage: string;
  statusCode: number;
  retryable: boolean;
}

const stringifyUnknown = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  try {
    return typeof error === "string" ? error : JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const readStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;

  const fields = error as Record<string, unknown>;
  const rawStatus = fields.status ?? fields.statusCode ?? fields.code;

  if (typeof rawStatus === "number") return rawStatus;
  if (typeof rawStatus === "string") {
    const parsed = Number.parseInt(rawStatus, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const readStatusCodeFromMessage = (message: string): number | undefined => {
  const match = message.match(/\b(400|401|403|408|429|500|502|503|504)\b/);
  if (!match) return undefined;

  return Number.parseInt(match[1], 10);
};

const readErrorName = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;

  const name = (error as Record<string, unknown>).name;
  return typeof name === "string" ? name : undefined;
};

export const classifyAnalysisError = (error: unknown): ClassifiedAnalysisError => {
  if (error instanceof PublicAnalysisError) {
    return {
      errorCode: error.errorCode,
      publicMessage: error.publicMessage,
      statusCode: error.statusCode,
      retryable: error.retryable,
    };
  }

  const message = stringifyUnknown(error);
  const statusCode = readStatusCode(error) ?? readStatusCodeFromMessage(message);
  const errorName = readErrorName(error);
  const lowerMessage = message.toLowerCase();
  const lowerName = errorName?.toLowerCase() ?? "";

  if (error instanceof SyntaxError) {
    return {
      errorCode: "invalid_request",
      publicMessage: "The analysis request was not valid JSON. Please refresh and try again.",
      statusCode: 400,
      retryable: false,
    };
  }

  if (
    statusCode === 429 ||
    lowerMessage.includes("too many requests") ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("resource exhausted")
  ) {
    return {
      errorCode: "gemini_quota",
      publicMessage:
        "Gemini quota or rate limit was reached. Please try again later; if this keeps happening, the site owner needs to check the Gemini API key quota or billing.",
      statusCode: 429,
      retryable: true,
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lowerMessage.includes("api key") ||
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("unauthorized")
  ) {
    return {
      errorCode: "gemini_auth",
      publicMessage: "Gemini rejected the site API key. The site owner needs to check the GEMINI_API_KEY setting.",
      statusCode: 502,
      retryable: false,
    };
  }

  if (
    statusCode === 408 ||
    statusCode === 504 ||
    lowerName.includes("abort") ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("deadline") ||
    lowerMessage.includes("aborted")
  ) {
    return {
      errorCode: "gemini_timeout",
      publicMessage: "Gemini did not respond before the request timed out. Please try again in a minute.",
      statusCode: 504,
      retryable: true,
    };
  }

  if (
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    lowerMessage.includes("fetch failed") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("econnreset") ||
    lowerMessage.includes("enotfound") ||
    lowerMessage.includes("unavailable") ||
    lowerMessage.includes("overloaded")
  ) {
    return {
      errorCode: "gemini_unavailable",
      publicMessage: "Gemini is temporarily unavailable. Please try again later.",
      statusCode: 503,
      retryable: true,
    };
  }

  return {
    errorCode: "analysis_failed",
    publicMessage: "Analysis failed. Please try again later.",
    statusCode: 500,
    retryable: true,
  };
};
