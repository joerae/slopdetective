import { cleanupOldAnalysisJobs, getAnalysisJobStore } from "../../server/analysisJobStore";
import { createRequestId, logError, logInfo, logWarn } from "../../server/logger";

const jsonResponse = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(body),
});

export const config = {
  schedule: "@daily",
};

export const handler = async (event: any, context: any) => {
  const requestId = context?.awsRequestId || createRequestId();

  if (event.httpMethod && event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    logWarn("analysis_blob_cleanup_method_not_allowed", {
      requestId,
      method: event.httpMethod,
    });

    return jsonResponse(405, {
      error: "Method not allowed.",
      requestId,
    });
  }

  try {
    const store = getAnalysisJobStore(event);
    const result = await cleanupOldAnalysisJobs(store);

    logInfo("analysis_blob_cleanup_completed", {
      requestId,
      checked: result.checked,
      deleted: result.deleted,
      cutoff: result.cutoff,
    });

    return jsonResponse(200, {
      ok: true,
      ...result,
      requestId,
    });
  } catch (error) {
    logError("analysis_blob_cleanup_failed", {
      requestId,
      error,
    });

    return jsonResponse(500, {
      error: "Could not clean up old analysis blobs.",
      requestId,
    });
  }
};
