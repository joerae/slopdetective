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

  const body = JSON.stringify(payload);

  console.error("[client_error]", payload);

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
