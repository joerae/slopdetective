import { createHash, timingSafeEqual } from "node:crypto";

export const ANALYSIS_JOB_TOKEN_HEADER = "x-analysis-job-token";

const getSecretMaterial = (): string => {
  const secret = process.env.ANALYSIS_JOB_TOKEN || process.env.GEMINI_API_KEY;
  if (!secret) {
    throw new Error("ANALYSIS_JOB_TOKEN or GEMINI_API_KEY must be configured to trigger background analysis jobs.");
  }

  return secret;
};

export const createAnalysisJobToken = (): string => {
  return createHash("sha256").update(getSecretMaterial()).digest("hex");
};

const readHeader = (headers: Record<string, unknown> | undefined, headerName: string): string | undefined => {
  if (!headers) return undefined;

  const direct = headers[headerName] ?? headers[headerName.toLowerCase()] ?? headers[headerName.toUpperCase()];
  if (typeof direct === "string") return direct;

  const matched = Object.entries(headers).find(([key]) => key.toLowerCase() === headerName.toLowerCase());
  return typeof matched?.[1] === "string" ? matched[1] : undefined;
};

export const hasValidAnalysisJobToken = (headers: Record<string, unknown> | undefined): boolean => {
  const received = readHeader(headers, ANALYSIS_JOB_TOKEN_HEADER);
  if (!received) return false;

  const expected = createAnalysisJobToken();
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
};
