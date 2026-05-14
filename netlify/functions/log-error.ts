import { createRequestId, logError } from "../../server/logger";

const jsonResponse = (statusCode: number, body: Record<string, unknown> = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const safeParseBody = (body: string | null) => {
  if (!body) return {};
  return JSON.parse(body);
};

export const handler = async (event: any, context: any) => {
  const requestId = context?.awsRequestId || createRequestId();

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: "Method not allowed.",
      requestId,
    });
  }

  try {
    const body = safeParseBody(event.body);

    logError("client_error", {
      requestId,
      source: body.source,
      name: body.name,
      message: body.message,
      stack: body.stack,
      details: body.details,
      url: body.url,
      userAgent: body.userAgent,
      metadata: body.metadata,
    });

    return jsonResponse(200, {
      ok: true,
      requestId,
    });
  } catch (error) {
    logError("client_error_logging_failed", {
      requestId,
      error,
    });

    return jsonResponse(400, {
      error: "Invalid log payload.",
      requestId,
    });
  }
};
