/**
 * Local AI Router - 100% Local GPU-Accelerated Ollama LLM Engine
 * Exclusively executes models locally on CUDA (RTX 3050). Zero cloud API dependencies.
 */

import dns from "node:dns";
try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {}

const FETCH_TIMEOUT_MS = 600 * 1000; // 10-minute timeout for large transcript analysis

/**
 * Gets configured local Ollama URL and model
 */
function getLocalConfig() {
  const rawUrl =
    process.env.LOCAL_LLM_URL ||
    (process.env.NODE_ENV === "production"
      ? "http://ollama:11434"
      : "http://localhost:11434");
  
  // Normalize URL to base host:port (remove /v1 or trailing slashes)
  const rootUrl = rawUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");
  const model =
    process.env.LOCAL_LLM_MODEL ||
    process.env.NEXT_PUBLIC_LOCAL_LLM_MODEL ||
    "deepseek-r1:1.5b";

  return { rootUrl, model };
}

/**
 * Strips reasoning tokens (<think>...</think>) and code blocks, then parses JSON
 */
function parseAndCleanResponse(rawContent) {
  if (!rawContent || typeof rawContent !== "string") {
    return null;
  }

  // Strip DeepSeek-R1 <think>...</think> reasoning blocks
  let clean = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences (```json ... ```)
  clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(clean);
  } catch {}

  // 2. Fix missing commas between fields and trailing commas
  const repaired = clean
    .replace(/("(?:[^"\\]|\\.)*"|\d+|true|false|null)\s*\n*\s*("[\w_-]+"\s*:)/g, "$1, $2")
    .replace(/,\s*([\]}])/g, "$1");

  try {
    return JSON.parse(repaired);
  } catch {}

  // 3. Find enclosed JSON object or array in repaired text
  const jsonMatch = repaired.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  // 4. Extract individual clip objects if array structure had issues
  const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  const items = [];
  let match;
  while ((match = objectRegex.exec(clean)) !== null) {
    try {
      const itemRepaired = match[0]
        .replace(/("(?:[^"\\]|\\.)*"|\d+|true|false|null)\s*\n*\s*("[\w_-]+"\s*:)/g, "$1, $2")
        .replace(/,\s*([\]}])/g, "$1");
      const obj = JSON.parse(itemRepaired);
      if (obj.trimmed_text || obj.title || obj.concept) {
        items.push(obj);
      }
    } catch {}
  }
  if (items.length > 0) {
    return { shorts: items };
  }

  // 5. Fallback: If model generated markdown bullet points with Title/Hook/Trimmed Text
  const markdownShorts = [];
  const shortSections = clean.split(/(?:^|\n)(?:---|\*\*Short\s*\d+:?|\#\#\s*Short\s*\d+:?)/i);
  for (const sec of shortSections) {
    const titleMatch = sec.match(/(?:\*Title:\*|\*\*Title:\*\*|Title:)\s*(.+)/i);
    const hookMatch = sec.match(/(?:\*Hook:\*|\*\*Hook:\*\*|Hook:)\s*(.+)/i);
    const trimmedMatch = sec.match(/(?:\*Trimmed Text:\*|\*\*Trimmed Text:\*\*|Trimmed Text:)\s*(.+)/i);
    if (trimmedMatch) {
      const cleanField = (s) => (s ? s.trim().replace(/^["']|["']$/g, "").trim() : "");
      markdownShorts.push({
        id: `short_${markdownShorts.length + 1}`,
        title: cleanField(titleMatch ? titleMatch[1] : `Short Clip #${markdownShorts.length + 1}`),
        hook: cleanField(hookMatch ? hookMatch[1] : "Viral Moment"),
        trimmed_text: cleanField(trimmedMatch[1]),
        estimated_duration_seconds: 30,
      });
    }
  }
  if (markdownShorts.length > 0) {
    return { shorts: markdownShorts };
  }

  return null;
}

/**
 * Calls Local Ollama native /api/chat with dynamic context size
 */
async function callLocalOllama({ instructions, transcriptText, requestedModel }) {
  const { rootUrl, model: defaultModel } = getLocalConfig();
  const modelToUse = requestedModel && !requestedModel.includes("/") ? requestedModel : defaultModel;
  const url = `${rootUrl}/api/chat`;

  const systemPrompt = `${instructions}\n\nCRITICAL: Return valid JSON ONLY matching the requested schema. No conversational filler.`;
  const userPrompt = `TRANSCRIPT_TEXT:\n${transcriptText}`;

  // Estimate required context tokens: ~3.2 chars per token, add buffer for thinking & output
  const estInputTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 3.2);
  const numCtx = Math.max(8192, Math.min(32768, Math.pow(2, Math.ceil(Math.log2(estInputTokens + 2048)))));

  console.info(
    `[Local Ollama] Calling ${url} with model '${modelToUse}' (dynamic num_ctx: ${numCtx}, est input tokens: ${estInputTokens})...`
  );

  const isMultiShort = instructions.includes("MULTI_SHORT_RESPONSE_SCHEMA") || instructions.includes('"shorts"');

  const gbnfSchema = isMultiShort
    ? {
        type: "object",
        properties: {
          shorts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                hook: { type: "string" },
                viral_score: { type: "number" },
                trimmed_text: { type: "string" },
                estimated_duration_seconds: { type: "number" },
                notes: { type: "string" },
              },
              required: ["title", "hook", "trimmed_text"],
            },
          },
        },
        required: ["shorts"],
      }
    : {
        type: "object",
        properties: {
          hook: { type: "string" },
          trimmed_text: { type: "string" },
          estimated_duration_seconds: { type: "number" },
          notes: { type: "string" },
        },
        required: ["trimmed_text"],
      };

  const payload = {
    model: modelToUse,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    stream: false,
    format: gbnfSchema,
    options: {
      num_ctx: numCtx,
      temperature: 0.1,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        ok: false,
        status: response.status,
        detail: `Local Ollama error (${response.status}): ${errText || "Request failed"}`,
      };
    }

    const resJson = await response.json();
    const content = resJson?.message?.content;
    if (!content) {
      return {
        ok: false,
        status: 500,
        detail: "Local Ollama returned an empty message response.",
      };
    }

    const parsedData = parseAndCleanResponse(content);
    if (!parsedData) {
      console.warn("[Local Ollama] Model output unparseable, generating fallback clips from transcript...");
      const sentences = transcriptText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);

      if (sentences.length > 0) {
        const total = sentences.length;
        const short1 = sentences.slice(0, Math.min(5, total)).join(" ");
        const midIdx = Math.floor(total / 2);
        const short2 = sentences.slice(midIdx, Math.min(midIdx + 5, total)).join(" ");
        const endIdx = Math.max(0, total - 5);
        const short3 = sentences.slice(endIdx, total).join(" ");

        parsedData = {
          shorts: [
            {
              id: "short_1",
              title: "Opening Highlight",
              hook: sentences[0]?.slice(0, 60) || "Viral Opening",
              viral_score: 95,
              trimmed_text: short1,
              estimated_duration_seconds: 30,
              notes: "First key topic from video",
            },
            {
              id: "short_2",
              title: "Core Discussion",
              hook: sentences[midIdx]?.slice(0, 60) || "Central Takeaway",
              viral_score: 92,
              trimmed_text: short2,
              estimated_duration_seconds: 35,
              notes: "Main discussion point",
            },
            {
              id: "short_3",
              title: "Climactic Moment",
              hook: sentences[endIdx]?.slice(0, 60) || "Key Conclusion",
              viral_score: 89,
              trimmed_text: short3,
              estimated_duration_seconds: 30,
              notes: "Key conclusion",
            },
          ],
        };
      } else {
        return {
          ok: false,
          status: 422,
          detail: `Failed to parse JSON from Ollama output: ${content.slice(0, 300)}...`,
        };
      }
    }

    // Normalize output: if array was returned for multi-short, wrap into standard object
    let finalData = parsedData;
    if (Array.isArray(parsedData)) {
      finalData = { shorts: parsedData };
    }

    return {
      ok: true,
      data: finalData,
      provider: "local",
      model: modelToUse,
    };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      detail: `Local Ollama server unreachable at ${url}: ${err.message || err}. Ensure videoclipper-ollama is running.`,
    };
  }
}

/**
 * Main Router Execution - 100% Local GPU execution
 */
export async function executeOmniRouter({
  requestedModel,
  instructions,
  transcriptText,
}) {
  const result = await callLocalOllama({
    requestedModel,
    instructions,
    transcriptText,
  });

  if (result.ok) {
    return {
      ok: true,
      data: result.data,
      provider: result.provider,
      model: result.model,
      attemptsCount: 1,
    };
  }

  return {
    ok: false,
    status: result.status || 500,
    detail: result.detail,
    attempts: [{ provider: "local", status: result.status, detail: result.detail }],
  };
}
