const GOOGLE_API_KEY_PATTERN = /AIza[0-9A-Za-z\-_]{20,}/g;
const SENSITIVE_FIELD_PATTERN = /^(api[-_]?key|gemini[-_]?api[-_]?key|authorization|cookie|set-cookie|x-api-key)$/i;

export const redactSensitiveString = (value: string): string => {
  return value.replace(GOOGLE_API_KEY_PATTERN, match => `${match.slice(0, 4)}...[redacted]`);
};

export const isSensitiveLogField = (key: string): boolean => {
  return SENSITIVE_FIELD_PATTERN.test(key);
};

export const redactSensitiveFieldValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value.length >= 4 ? `${value.slice(0, 4)}...[redacted]` : "[redacted]";
  }

  if (value === undefined || value === null) return value;

  return "[redacted]";
};
