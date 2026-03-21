import { gateway, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { config } from "@/lib/config";

function stripProviderPrefix(modelId: string) {
  return modelId.startsWith("google/") ? modelId.slice("google/".length) : modelId;
}

export function hasLanguageModelAccess() {
  return Boolean(config.aiGatewayApiKey || config.googleApiKey);
}

export function getLanguageModel(modelId: string): LanguageModel {
  if (config.aiGatewayApiKey) {
    return gateway(modelId) as unknown as LanguageModel;
  }

  if (!config.googleApiKey) {
    throw new Error("No AI model credentials are configured. Set AI_GATEWAY_API_KEY or GEMINI_API_KEY.");
  }

  const google = createGoogleGenerativeAI({
    apiKey: config.googleApiKey,
  });

  return google(stripProviderPrefix(modelId)) as unknown as LanguageModel;
}
