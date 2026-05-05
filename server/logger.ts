import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const MAX_STRING_LENGTH = 1200;

export const createRequestId = (): string => {
  return randomUUID();
};

const scrubString = (value: string): string => {
  return value
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[redacted-google-api-key]")
    .slice(0, MAX_STRING_LENGTH);
};

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeValue);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      stack: value.stack ? scrubString(value.stack) : undefined,
    };
  }
  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry)])
    );
  }

  return undefined;
};

const writeLog = (level: LogLevel, event: string, fields: LogFields = {}) => {
  const sanitizedFields = sanitizeValue(fields) as LogFields;
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizedFields,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
};

export const logInfo = (event: string, fields?: LogFields) => writeLog("info", event, fields);
export const logWarn = (event: string, fields?: LogFields) => writeLog("warn", event, fields);
export const logError = (event: string, fields?: LogFields) => writeLog("error", event, fields);
