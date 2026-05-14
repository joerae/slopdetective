import { isSensitiveLogField, redactSensitiveFieldValue, redactSensitiveString } from "../shared/logRedaction";

interface ClientErrorContext {
  source: string;
  metadata?: Record<string, unknown>;
}

interface ClientErrorPayload {
  source: string;
  name: string;
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

let globalHandlersInstalled = false;

const sanitizeClientLogValue = (value: unknown, key?: string): unknown => {
  if (key && isSensitiveLogField(key)) return redactSensitiveFieldValue(value);
  if (typeof value === "string") return redactSensitiveString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(entry => sanitizeClientLogValue(entry));
  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entry]) => [
        entryKey,
        sanitizeClientLogValue(entry, entryKey),
      ])
    );
  }

  return undefined;
};

const sanitizeClientLogPayload = (payload: ClientErrorPayload): ClientErrorPayload => {
  return sanitizeClientLogValue(payload) as ClientErrorPayload;
};

const normalizeCustomErrorFields = (error: Error) => {
  const details: Record<string, unknown> = {};

  Object.entries(error as unknown as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined) {
      details[key] = value;
    }
  });

  return Object.keys(details).length ? details : undefined;
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      details: normalizeCustomErrorFields(error),
    };
  }

  let message = "Unknown error";
  try {
    message = typeof error === "string" ? error : JSON.stringify(error);
  } catch {
    message = String(error);
  }

  return {
    name: "UnknownError",
    message,
    stack: undefined,
    details: undefined,
  };
};

const sendClientError = (payload: ClientErrorPayload) => {
  if (typeof window === "undefined") return;

  const safePayload = sanitizeClientLogPayload(payload);
  const body = JSON.stringify(safePayload);

  console.error("[client_error]", safePayload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/.netlify/functions/log-error", blob)) {
      return;
    }
  }

  void fetch("/.netlify/functions/log-error", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Avoid recursive logging if the logger endpoint itself is unavailable.
  });
};

export const logClientError = (error: unknown, context: ClientErrorContext) => {
  const normalized = normalizeError(error);

  sendClientError({
    ...normalized,
    source: context.source,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    metadata: context.metadata,
  });
};

export const installGlobalErrorHandlers = () => {
  if (globalHandlersInstalled || typeof window === "undefined") return;
  globalHandlersInstalled = true;

  window.addEventListener("error", event => {
    logClientError(event.error || event.message, {
      source: "window.error",
      metadata: {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", event => {
    logClientError(event.reason, {
      source: "window.unhandledrejection",
    });
  });
};
