// backend/src/services/llmClient.js
import OpenAI from "openai";

const {
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_MODEL = "o3-mini",
    LLM_MAX_TOKENS = "1200",
    LLM_TEMPERATURE = "0.3",
} = process.env;

if (!OPENAI_API_KEY) {
    console.warn("[LLM] OPENAI_API_KEY 未配置，将导致摘要不可用。");
}

export function buildOpenAI() {
    const client = new OpenAI({
        apiKey: OPENAI_API_KEY,
        ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
    });
    return { client };
}

export const LLM_DEFAULTS = {
    model: OPENAI_MODEL,
    max_output_tokens: parseInt(LLM_MAX_TOKENS, 10),
    temperature: parseFloat(LLM_TEMPERATURE),
};
