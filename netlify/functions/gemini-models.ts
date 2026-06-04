import type { GeminiModelInfo } from "../../types";
import { createRequestId, logError, logWarn } from "../../server/logger";

interface GeminiModelsApiModel {
  name?: string;
  baseModelId?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

interface GeminiModelsApiResponse {
  models?: GeminiModelsApiModel[];
  error?: {
    message?: string;
  };
}

const jsonResponse = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(body),
});

const stripModelResourcePrefix = (name: string) => name.replace(/^models\//, "");

const mapModel = (model: GeminiModelsApiModel): GeminiModelInfo | null => {
  const modelName = typeof model.name === "string" ? model.name : "";
  const id = typeof model.baseModelId === "string" && model.baseModelId
    ? model.baseModelId
    : stripModelResourcePrefix(modelName);

  if (!id) return null;

  return {
    id,
    name: modelName || `models/${id}`,
    displayName: model.displayName || id,
    description: model.description,
    inputTokenLimit: model.inputTokenLimit,
    outputTokenLimit: model.outputTokenLimit,
  };
};

export const handler = async (event: any, context: any) => {
  const requestId = context?.awsRequestId || createRequestId();

  if (event.httpMethod !== "GET") {
    logWarn("gemini_models_method_not_allowed", {
      requestId,
      method: event.httpMethod,
    });

    return jsonResponse(405, {
      error: "Method not allowed.",
      requestId,
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return jsonResponse(500, {
      error: "Gemini models are not configured. The site owner needs to set GEMINI_API_KEY.",
      requestId,
    });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    const responseText = await response.text();
    const payload = responseText ? JSON.parse(responseText) as GeminiModelsApiResponse : {};

    if (!response.ok) {
      return jsonResponse(response.status, {
        error: payload.error?.message || "Gemini models could not be loaded.",
        requestId,
      });
    }

    const modelById = new Map<string, GeminiModelInfo>();
    (payload.models || [])
      .filter(model => model.supportedGenerationMethods?.includes("generateContent"))
      .map(mapModel)
      .filter((model): model is GeminiModelInfo => Boolean(model))
      .forEach(model => {
        if (!modelById.has(model.id)) {
          modelById.set(model.id, model);
        }
      });

    const models = Array.from(modelById.values()).sort((a, b) => {
      const labelComparison = a.displayName.localeCompare(b.displayName);
      return labelComparison || a.id.localeCompare(b.id);
    });

    return jsonResponse(200, {
      models,
      requestId,
    });
  } catch (error) {
    logError("gemini_models_failed", {
      requestId,
      error,
    });

    return jsonResponse(500, {
      error: "Gemini models could not be loaded.",
      requestId,
    });
  }
};
