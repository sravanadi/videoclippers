/**
 * Omni Router - Multi-Provider AI LLM Routing & Automatic Failover Engine
 * Supports OpenRouter, NVIDIA NIM, Google Gemini, and Local Self-Hosted Ollama/vLLM.
 */

const DEFAULT_OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

const COOLDOWN_MS = 60 * 1000; // 60-second cooldown for rate-limited providers
const FETCH_TIMEOUT_MS = 600 * 1000; // 10-minute timeout for large transcript prompts

// Provider Cooldown & Health State
const providerState = {
  nvidia: { cooldownUntil: 0, failureCount: 0 },
  openrouter: { cooldownUntil: 0, failureCount: 0 },
  google: { cooldownUntil: 0, failureCount: 0 },
  local: { cooldownUntil: 0, failureCount: 0 },
};

/**
 * Checks if a provider is available and not in cooldown
 */
function isProviderHealthy(providerId) {
  const state = providerState[providerId];
  if (!state) return true;
  return Date.now() >= state.cooldownUntil;
}

/**
 * Marks a provider with a temporary cooldown after a failure
 */
function markProviderFailure(providerId, status, detail) {
  const state = providerState[providerId] || { failureCount: 0, cooldownUntil: 0 };
  state.failureCount += 1;
  state.cooldownUntil = Date.now() + COOLDOWN_MS;
  providerState[providerId] = state;
  console.warn(
    `[Omni Router] Provider '${providerId}' failed (Status ${status}): ${detail}. Placed in 60s cooldown.`
  );
}

/**
 * Marks a provider as healthy on successful response
 */
function markProviderSuccess(providerId) {
  const state = providerState[providerId];
  if (state) {
    state.failureCount = 0;
    state.cooldownUntil = 0;
  }
}

/**
 * Gets configured API credentials for a given provider
 */
function getProviderConfig(providerId) {
  switch (providerId) {
    case "nvidia": {
      const apiKey = (process.env.NVIDIA_API_KEY || "").trim();
      return {
        providerId: "nvidia",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        defaultModel: "meta/llama-3.3-70b-instruct",
        apiKey,
        isConfigured: Boolean(apiKey),
        isOpenAICompatible: true,
      };
    }

    case "openrouter": {
      const apiKey = (
        process.env.OPENROUTER_API_KEY ||
        process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
        process.env.GEMINI_API_KEY ||
        DEFAULT_OPENROUTER_KEY
      ).trim();
      return {
        providerId: "openrouter",
        baseUrl:
          process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
        defaultModel: "google/gemini-2.0-flash-exp",
        apiKey,
        isConfigured: Boolean(apiKey),
        isOpenAICompatible: true,
      };
    }

    case "local": {
      const baseUrl = (
        process.env.LOCAL_LLM_URL || "http://localhost:11434/v1"
      ).replace(/\/$/, "");
      return {
        providerId: "local",
        baseUrl,
        defaultModel: process.env.LOCAL_LLM_MODEL || "llama3.2:latest",
        apiKey: process.env.LOCAL_LLM_API_KEY || "ollama",
        isConfigured: true, // Local Ollama server does not require external key
        isOpenAICompatible: true,
      };
    }

    case "google": {
      const apiKey = (
        process.env.GEMINI_API_KEY ||
        process.env.VITE_GEMINI_API_KEY ||
        ""
      ).trim();
      return {
        providerId: "google",
        baseUrl: "https://generativelanguage.googleapis.com",
        defaultModel: "models/gemini-2.0-flash",
        apiKey,
        isConfigured: Boolean(apiKey),
        isOpenAICompatible: false,
      };
    }

    default:
      return null;
  }
}

/**
 * Builds candidate provider chain starting with preferred provider
 */
function buildProviderChain(preferredProviderId) {
  const allProviders = ["nvidia", "openrouter", "google", "local"];
  const chain = [];

  // Add preferred provider first if valid
  if (preferredProviderId && allProviders.includes(preferredProviderId)) {
    chain.push(preferredProviderId);
  }

  // Append remaining providers in priority order
  for (const pid of allProviders) {
    if (!chain.includes(pid)) {
      chain.push(pid);
    }
  }

  // Filter down to configured providers
  return chain.map(getProviderConfig).filter((cfg) => cfg && cfg.isConfigured);
}

/**
 * Generates response using OpenAI-compatible endpoints (OpenRouter, NVIDIA, Local Ollama)
 */
async function callOpenAICompatible({
  baseUrl,
  apiKey,
  model,
  instructions,
  transcriptText,
}) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const systemPrompt = `${instructions}\n\nReturn JSON ONLY. You MUST adhere strictly to the JSON schema specified in the instructions.`;
  const userPrompt = `TRANSCRIPT_TEXT:\n${transcriptText}`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (netErr) {
    return {
      ok: false,
      status: 504,
      detail: `Network request failed to ${url}: ${netErr.message || netErr}`,
    };
  }

  const rawText = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: rawText || `HTTP ${response.status} from ${url}`,
    };
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (jsonErr) {
    return {
      ok: false,
      status: 500,
      detail: `Failed to parse OpenAI endpoint response JSON: ${jsonErr.message}`,
    };
  }

  const content = parsedJson?.choices?.[0]?.message?.content;
  if (!content) {
    return {
      ok: false,
      status: 500,
      detail: "OpenAI-compatible endpoint returned empty completion message content",
    };
  }

  let finalData;
  try {
    finalData = JSON.parse(content);
  } catch {
    // Return wrapped text if model output text directly
    finalData = { text: content };
  }

  return { ok: true, data: finalData };
}

/**
 * Generates response using Google Native Gemini REST API
 */
async function callGoogleGemini({ apiKey, model, instructions, transcriptText }) {
  const modelPath = model.startsWith("models/") ? model : `models/${model}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${instructions}\n\nTRANSCRIPT_TEXT:\n${transcriptText}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (netErr) {
    return {
      ok: false,
      status: 504,
      detail: `Google Gemini network request failed: ${netErr.message || netErr}`,
    };
  }

  const rawText = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: rawText || `HTTP ${response.status} from Google Gemini`,
    };
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (e) {
    return {
      ok: false,
      status: 500,
      detail: `Failed to parse Gemini response JSON: ${e.message}`,
    };
  }

  const candidateText =
    parsedJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!candidateText) {
    return {
      ok: false,
      status: 500,
      detail: "Google Gemini returned empty candidate text",
    };
  }

  let finalData;
  try {
    finalData = JSON.parse(candidateText);
  } catch {
    finalData = { text: candidateText };
  }

  return { ok: true, data: finalData };
}

/**
 * Main Omni Router Execution Function
 * Orchestrates multi-provider execution with smart health failover
 */
export async function executeOmniRouter({
  preferredProviderId,
  requestedModel,
  instructions,
  transcriptText,
}) {
  const providerChain = buildProviderChain(preferredProviderId);
  if (providerChain.length === 0) {
    return {
      ok: false,
      status: 500,
      detail:
        "No AI Providers are configured. Please set OPENROUTER_API_KEY, NVIDIA_API_KEY, or GEMINI_API_KEY in .env",
    };
  }

  const attemptsLog = [];

  for (const config of providerChain) {
    const { providerId, baseUrl, apiKey, defaultModel, isOpenAICompatible } =
      config;

    // Skip if provider is currently in rate-limit cooldown (unless it's our only option)
    if (!isProviderHealthy(providerId) && providerChain.length > 1) {
      console.info(
        `[Omni Router] Skipping '${providerId}' due to active rate-limit cooldown.`
      );
      continue;
    }

    const modelToUse =
      preferredProviderId === providerId && requestedModel
        ? requestedModel
        : defaultModel;

    console.info(
      `[Omni Router] Attempting generation with provider '${providerId}' using model '${modelToUse}'...`
    );

    let result;
    if (isOpenAICompatible) {
      result = await callOpenAICompatible({
        baseUrl,
        apiKey,
        model: modelToUse,
        instructions,
        transcriptText,
      });
    } else {
      result = await callGoogleGemini({
        apiKey,
        model: modelToUse,
        instructions,
        transcriptText,
      });
    }

    if (result.ok) {
      markProviderSuccess(providerId);
      console.info(
        `[Omni Router] Generation succeeded using provider '${providerId}' (${modelToUse}).`
      );
      return {
        ok: true,
        data: result.data,
        provider: providerId,
        model: modelToUse,
        attemptsCount: attemptsLog.length + 1,
      };
    }

    // Record failure & cooldown
    markProviderFailure(providerId, result.status, result.detail);
    attemptsLog.push({
      provider: providerId,
      status: result.status,
      detail: result.detail,
    });
  }

  // If all healthy options failed, return aggregated error
  return {
    ok: false,
    status: attemptsLog[0]?.status || 500,
    detail: `Omni Router: All AI Provider attempts failed. Details: ${attemptsLog
      .map((a) => `[${a.provider}:${a.status}] ${a.detail}`)
      .join(" | ")}`,
    attempts: attemptsLog,
  };
}
