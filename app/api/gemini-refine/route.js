import { NextResponse } from "next/server";
import {
  BASE_INSTRUCTIONS,
  SINGLE_RESPONSE_SCHEMA,
  buildMultiConceptSchema,
  MULTI_SHORT_RESPONSE_SCHEMA,
  SHORTENING_MODE_INSTRUCTIONS,
} from "./prompts";
import { executeOmniRouter } from "./omniRouter";

export const runtime = "nodejs";

const DEFAULT_VARIANT_COUNT = 3;
const MAX_VARIANT_COUNT = 3;
const MIN_VARIANT_COUNT = 1;
const DEFAULT_SHORTENING_MODE = "auto";
const SENTENCE_GAP_SECONDS = 0.85;
const SENTENCE_END_REGEX = /[.!?]$/;

const isValidShorteningMode = (mode) =>
  mode === "auto" ||
  mode === "sixty_seconds" ||
  mode === "thirty_seconds" ||
  mode === "multi_short";

const normalizeVariantCount = (value) => {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) return DEFAULT_VARIANT_COUNT;
  return Math.min(
    MAX_VARIANT_COUNT,
    Math.max(MIN_VARIANT_COUNT, numeric)
  );
};

const buildInstructions = (mode, variantCount) => {
  const resolved = isValidShorteningMode(mode)
    ? mode
    : DEFAULT_SHORTENING_MODE;
  const focus = SHORTENING_MODE_INSTRUCTIONS[resolved];
  const resolvedVariants = normalizeVariantCount(variantCount);
  const schemaSection =
    resolved === "multi_short"
      ? MULTI_SHORT_RESPONSE_SCHEMA
      : resolvedVariants > 1
      ? buildMultiConceptSchema(resolvedVariants)
      : SINGLE_RESPONSE_SCHEMA;
  return `${BASE_INSTRUCTIONS}\n\n${schemaSection}\n\nShortening objective:\n${focus}\n\nImplementation notes:\n- trimmed_text must use only words from TRANSCRIPT_TEXT, in order; deletions only.\n- Keep complete sentences; avoid clipped fragments.\n- estimated_duration_seconds can be a rough estimate.\n- Use notes to briefly describe the main deletions or any unmet constraints.`;
};

const readEnvProvider = () => {
  const explicit =
    process.env.GEMINI_PROVIDER?.trim().toLowerCase() ||
    process.env.NEXT_PUBLIC_GEMINI_PROVIDER?.trim().toLowerCase();
  if (explicit) return explicit;
  if (process.env.LOCAL_LLM_URL || process.env.USE_LOCAL_LLM === "true") return "local";
  if (process.env.NVIDIA_API_KEY) return "nvidia";
  const hasOpenRouterKey =
    !!(
      process.env.OPENROUTER_API_KEY ||
      process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
    );
  return hasOpenRouterKey ? "openrouter" : "google";
};

const normalizeProvider = (value) => {
  if (value === "nvidia") return "nvidia";
  if (value === "openrouter") return "openrouter";
  if (value === "local" || value === "ollama" || value === "vllm" || value === "lmstudio") return "local";
  return "google";
};

const resolveProvider = (requestedProvider) => {
  const candidate =
    typeof requestedProvider === "string" && requestedProvider.trim()
      ? requestedProvider.trim().toLowerCase()
      : readEnvProvider();
  return normalizeProvider(candidate);
};

const buildTranscriptText = (sourceWords) => {
  if (!Array.isArray(sourceWords)) return "";
  const parts = [];
  sourceWords.forEach((word, index) => {
    const text = typeof word?.text === "string" ? word.text.trim() : "";
    if (!text) return;
    parts.push(text);
    const currentEnd = Number.isFinite(word?.end) ? word.end : null;
    const nextStart = Number.isFinite(sourceWords[index + 1]?.start)
      ? sourceWords[index + 1].start
      : null;
    const gap =
      currentEnd !== null && nextStart !== null ? nextStart - currentEnd : 0;
    if (SENTENCE_END_REGEX.test(text) || gap >= SENTENCE_GAP_SECONDS) {
      parts.push("\n\n");
    }
  });
  return parts
    .join(" ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export async function POST(req) {
  try {
    const body = await req.json();
    const provider = resolveProvider(body?.provider);
    const { model, words, shorteningMode, variantCount: requestedVariants } =
      body || {};

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: "Missing transcript words" },
        { status: 400 }
      );
    }

    const sourceWords = words;
    const transcriptText = buildTranscriptText(sourceWords);
    const resolvedShorteningMode = isValidShorteningMode(shorteningMode)
      ? shorteningMode
      : DEFAULT_SHORTENING_MODE;

    const defaultVariantFallback =
      resolvedShorteningMode === "sixty_seconds" ||
      resolvedShorteningMode === "thirty_seconds"
        ? MAX_VARIANT_COUNT
        : DEFAULT_VARIANT_COUNT;
    const variantCount = normalizeVariantCount(
      requestedVariants ?? defaultVariantFallback
    );
    const instructions = buildInstructions(
      resolvedShorteningMode,
      variantCount
    );

    const result = await executeOmniRouter({
      preferredProviderId: provider,
      requestedModel: model,
      instructions,
      transcriptText,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Omni Router generation failed", detail: result.detail },
        { status: result.status || 500 }
      );
    }

    const response = NextResponse.json(result.data);
    response.headers.set("x-omni-router-provider", result.provider);
    response.headers.set("x-omni-router-model", result.model);
    response.headers.set("x-omni-router-attempts", String(result.attemptsCount));
    return response;
  } catch (error) {
    const causeMsg = error?.cause ? ` (${error.cause.message || error.cause.code || String(error.cause)})` : "";
    console.error("[Gemini API Route]", error, error?.cause);
    return NextResponse.json(
      {
        error: "Server error",
        detail: (error instanceof Error ? error.message : String(error)) + causeMsg,
      },
      { status: 500 }
    );
  }
}

async function uploadTranscriptFile({
  apiKey,
  contents,
  mimeType,
  apiVersion,
}) {
  const metadataResponse = await fetch(
    `${GEMINI_BASE_URL}/upload/${apiVersion}/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": METADATA_MIME_TYPE,
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Header-Content-Length": String(Buffer.byteLength(contents, "utf8")),
        "X-Goog-Upload-Header-Content-Type": mimeType,
      },
      body: JSON.stringify({
        file: {
          displayName: `transcript-${Date.now()}.txt`,
          mimeType,
        },
      }),
    }
  );

  if (!metadataResponse.ok) {
    const message = await metadataResponse.text();
    throw new Error(`Failed to start file upload: ${message}`);
  }

  const uploadUrl = metadataResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("Upload URL missing from Gemini response");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
    },
    body: contents,
  });

  if (!uploadResponse.ok) {
    const message = await uploadResponse.text();
    throw new Error(`Failed to upload transcript: ${message}`);
  }

  const uploaded = await uploadResponse.json();
  const fileRecord = uploaded?.file ?? uploaded;
  const fileUri = fileRecord?.uri || fileRecord?.fileUri || null;
  const fileName = fileRecord?.name || null;

  if (!fileUri && !fileName) {
    throw new Error("Uploaded file metadata is missing identifiers");
  }

  if (fileUri) {
    return fileUri;
  }

  // Older responses might only include the resource name (files/abc)
  return `files/${fileName.replace(/^files\//, "")}`;
}

async function generateWithGemini({ apiKey, targetModel, parts, apiVersion }) {
  const payload = {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generationConfig: GENERATION_CONFIG,
  };

  const geminiUrl = `${GEMINI_BASE_URL}/${apiVersion}/${targetModel}:generateContent?key=${apiKey}`;

  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(600000),
  });

  if (response.ok) {
    return { ok: true, data: await response.json() };
  }

  const errorText = await response.text();
  return {
    ok: false,
    status: response.status,
    detail: errorText,
  };
}

async function generateWithOpenRouter({
  apiKey,
  targetModel,
  instructions,
  transcriptText,
  baseUrl = OPENROUTER_BASE_URL,
}) {
  const messages = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: instructions,
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `TRANSCRIPT_TEXT:\n${transcriptText}`,
        },
      ],
    },
  ];

  const payload = {
    model: targetModel,
    messages,
    temperature: GENERATION_CONFIG.temperature,
    top_p: GENERATION_CONFIG.topP,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = OPENROUTER_SITE_URL;
    headers["X-Title"] = OPENROUTER_APP_TITLE;
  }

  let response;
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(600000),
      });
      if (response.ok || response.status < 500) {
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini API Route] Fetch attempt ${attempt} failed:`, err?.message || err, err?.cause);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  if (!response) {
    const cause = lastError?.cause ? ` (${lastError.cause.message || lastError.cause.code || String(lastError.cause)})` : "";
    return {
      ok: false,
      status: 502,
      detail: `Network fetch failed connecting to API: ${lastError?.message || "Unknown error"}${cause}`,
    };
  }

  if (!response.ok) {
    const detail = await response.text();
    return {
      ok: false,
      status: response.status,
      detail,
    };
  }

  const raw = await response.json();
  const aggregatedText = extractStructuredAssistantText(raw);

  if (!aggregatedText) {
    console.warn("[Gemini API Route] OpenRouter response missing assistant text", raw);
    return {
      ok: false,
      status: 502,
      detail: "OpenRouter response did not include any text output.",
    };
  }

  return {
    ok: true,
    data: buildGeminiCandidateFromText(aggregatedText),
  };
}

const extractStructuredAssistantText = (payload) => {
  const choice = payload?.choices?.[0];
  if (!choice) return "";
  const content =
    choice?.message?.content ??
    choice?.content ??
    (typeof choice.text === "string" ? choice.text : "");
  const flattened = flattenOpenRouterMessageContent(content).trim();
  if (!flattened) return "";
  return stripJsonFences(flattened);
};

const flattenOpenRouterMessageContent = (content) => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) return "";
        if (typeof part === "string") return part;
        if (typeof part.text === "string") return part.text;
        if (typeof part.content === "string") return part.content;
        if (typeof part.type === "string") {
          if (part.type === "text" && typeof part.text === "string") {
            return part.text;
          }
          return "";
        }
        if (Array.isArray(part.content)) {
          return flattenOpenRouterMessageContent(part.content);
        }
        return "";
      })
      .join("");
  }
  if (typeof content.text === "string") return content.text;
  if (typeof content.content === "string") return content.content;
  return "";
};

const stripJsonFences = (value) =>
  value
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();

const extractGeminiResponseText = (payload) => {
  const candidate = payload?.candidates?.[0];
  const aggregatedText = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim()
    : candidate?.output_text?.trim?.() ?? "";
  return aggregatedText ? stripJsonFences(aggregatedText) : "";
};

const normalizeKeepRanges = (value, maxIndex) => {
  if (!Array.isArray(value)) return [];
  const ranges = value
    .map((range) => {
      if (!Array.isArray(range) || range.length < 2) return null;
      const start = Number.parseInt(range[0], 10);
      const end = Number.parseInt(range[1], 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      const clampedStart = Math.min(maxIndex, Math.max(0, start));
      const clampedEnd = Math.min(maxIndex, Math.max(0, end));
      const from = Math.min(clampedStart, clampedEnd);
      const to = Math.max(clampedStart, clampedEnd);
      return { start: from, end: to };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  ranges.forEach((range) => {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + 1) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  });
  return merged;
};

const normalizeWordToken = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, "");

const tokenizeTranscriptText = (text) =>
  String(text || "")
    .split(/\s+/)
    .map(normalizeWordToken)
    .filter(Boolean);

const buildSentenceRanges = (sourceWords) => {
  if (!Array.isArray(sourceWords) || !sourceWords.length) return [];
  const ranges = [];
  let rangeStart = 0;
  sourceWords.forEach((word, index) => {
    const text = typeof word?.text === "string" ? word.text.trim() : "";
    const endMatch = text ? SENTENCE_END_REGEX.test(text) : false;
    const currentEnd = Number.isFinite(word?.end) ? word.end : null;
    const nextStart = Number.isFinite(sourceWords[index + 1]?.start)
      ? sourceWords[index + 1].start
      : null;
    const gap =
      currentEnd !== null && nextStart !== null ? nextStart - currentEnd : 0;
    if (endMatch || gap >= SENTENCE_GAP_SECONDS) {
      ranges.push({ start: rangeStart, end: index });
      rangeStart = index + 1;
    }
  });
  if (rangeStart < sourceWords.length) {
    ranges.push({ start: rangeStart, end: sourceWords.length - 1 });
  }
  return ranges;
};

const filterIndicesBySentenceCoverage = (sourceWords, indices) => {
  if (!Array.isArray(sourceWords) || !indices?.length) return indices ?? [];
  const ranges = buildSentenceRanges(sourceWords);
  if (!ranges.length) return indices;
  const keptSet = new Set(indices);
  const strictSet = new Set();
  const looseSet = new Set();
  ranges.forEach((range) => {
    let kept = 0;
    for (let i = range.start; i <= range.end; i += 1) {
      if (keptSet.has(i)) kept += 1;
    }
    if (!kept) return;
    const total = range.end - range.start + 1;
    const coverage = total > 0 ? kept / total : 0;
    for (let i = range.start; i <= range.end; i += 1) {
      looseSet.add(i);
    }
    if (coverage >= SENTENCE_MIN_COVERAGE) {
      for (let i = range.start; i <= range.end; i += 1) {
        strictSet.add(i);
      }
    }
  });
  const strict = Array.from(strictSet).sort((a, b) => a - b);
  const loose = Array.from(looseSet).sort((a, b) => a - b);
  if (!strict.length) {
    return loose.length ? loose : indices;
  }
  if (strict.length < Math.max(5, Math.floor(indices.length * 0.6))) {
    return loose.length ? loose : strict;
  }
  return strict;
};

const buildTrimmedWordsFromIndices = (sourceWords, indices) => {
  if (!Array.isArray(sourceWords) || !indices?.length) return [];
  return indices.map((index) => {
    const word = sourceWords[index];
    return {
      text: word.text,
      start: word.start,
      end: word.end,
      speaker_id: word.speaker_id ?? null,
    };
  });
};

const buildTrimmedWordsFromText = (sourceWords, trimmedText) => {
  if (!Array.isArray(sourceWords) || !trimmedText) {
    return { words: [], matchRatio: 0, indices: [] };
  }
  const tokens = tokenizeTranscriptText(trimmedText);
  if (!tokens.length) return { words: [], matchRatio: 0, indices: [] };
  const normalizedSource = sourceWords.map((word, index) => ({
    index,
    normalized: normalizeWordToken(word?.text),
  }));
  let sourceIndex = 0;
  let matched = 0;
  const trimmedWords = [];
  const matchedIndices = [];
  tokens.forEach((token) => {
    if (!token) return;
    for (let i = sourceIndex; i < normalizedSource.length; i += 1) {
      if (normalizedSource[i].normalized === token) {
        const sourceWord = sourceWords[i];
        if (sourceWord && typeof sourceWord.text === "string") {
          trimmedWords.push({
            text: sourceWord.text,
            start: sourceWord.start,
            end: sourceWord.end,
            speaker_id: sourceWord.speaker_id ?? null,
          });
          matchedIndices.push(i);
          matched += 1;
        }
        sourceIndex = i + 1;
        return;
      }
    }
  });
  const matchRatio = tokens.length ? matched / tokens.length : 0;
  return { words: trimmedWords, matchRatio, indices: matchedIndices };
};

const buildTrimmedWordsFromRanges = (sourceWords, keepRanges) => {
  if (!Array.isArray(sourceWords) || sourceWords.length === 0) return [];
  const normalized = normalizeKeepRanges(
    keepRanges,
    sourceWords.length - 1
  );
  const trimmed = [];
  normalized.forEach((range) => {
    for (let index = range.start; index <= range.end; index += 1) {
      const word = sourceWords[index];
      if (!word || typeof word.text !== "string" || !word.text.trim()) continue;
      trimmed.push({
        text: word.text,
        start: word.start,
        end: word.end,
        speaker_id: word.speaker_id ?? null,
      });
    }
  });
  return trimmed;
};

const computeEstimatedDuration = (words) => {
  if (!Array.isArray(words) || !words.length) return null;
  const total = words.reduce((sum, word) => {
    const start = Number.isFinite(word?.start) ? word.start : 0;
    const end = Number.isFinite(word?.end) ? word.end : start;
    return sum + Math.max(0, end - start);
  }, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round(total * 10) / 10;
};

const ensureTrimmedWords = (entry, sourceWords) => {
  if (!entry || typeof entry !== "object") return entry;
  const trimmedText =
    typeof entry.trimmed_text === "string" ? entry.trimmed_text.trim() : "";
  const hasKeepRanges = Array.isArray(entry.keep_ranges);
  let trimmedWords = [];
  let trimmedTextAttempt = null;
  if (trimmedText) {
    trimmedTextAttempt = buildTrimmedWordsFromText(
      sourceWords,
      trimmedText
    );
    if (trimmedTextAttempt.matchRatio >= 0.65) {
      const filteredIndices = filterIndicesBySentenceCoverage(
        sourceWords,
        trimmedTextAttempt.indices
      );
      trimmedWords = buildTrimmedWordsFromIndices(
        sourceWords,
        filteredIndices
      );
    } else if (trimmedTextAttempt.words.length) {
      console.warn(
        "[Gemini API Route] Trimmed text alignment was low quality",
        trimmedTextAttempt.matchRatio
      );
    }
  }
  if (!trimmedWords.length && hasKeepRanges) {
    trimmedWords = buildTrimmedWordsFromRanges(sourceWords, entry.keep_ranges);
  }
  if (!trimmedWords.length && trimmedTextAttempt?.indices?.length) {
    const filteredIndices = filterIndicesBySentenceCoverage(
      sourceWords,
      trimmedTextAttempt.indices
    );
    trimmedWords = buildTrimmedWordsFromIndices(
      sourceWords,
      filteredIndices
    );
  }
  if (!trimmedWords.length && Array.isArray(entry.trimmed_words)) {
    trimmedWords = entry.trimmed_words;
  }
  const estimated =
    typeof entry.estimated_duration_seconds === "number" &&
    Number.isFinite(entry.estimated_duration_seconds)
      ? entry.estimated_duration_seconds
      : computeEstimatedDuration(trimmedWords);
  return {
    ...entry,
    trimmed_words: trimmedWords,
    estimated_duration_seconds: estimated ?? entry.estimated_duration_seconds,
  };
};

const expandGeminiResponse = (payload, sourceWords) => {
  if (!payload || !Array.isArray(sourceWords)) return null;
  const text = extractGeminiResponseText(payload);
  if (!text) return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    console.warn("[Gemini API Route] Failed to parse Gemini response JSON", error);
    return null;
  }
  if (Array.isArray(parsed?.concepts)) {
    const concepts = parsed.concepts.map((concept) =>
      ensureTrimmedWords(concept, sourceWords)
    );
    return JSON.stringify({ ...parsed, concepts });
  }
  return JSON.stringify(ensureTrimmedWords(parsed, sourceWords));
};

const buildGeminiCandidateFromText = (text) => ({
  candidates: [
    {
      content: {
        parts: [{ text }],
      },
      output_text: text,
    },
  ],
});
