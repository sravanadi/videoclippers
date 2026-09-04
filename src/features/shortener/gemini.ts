import type { TranscriptWord } from "@/lib/transcript";
import { normalizeGeminiRefinement } from "./normalize";
import type {
  GeminiRefinement,
  GeminiRefinementOptions,
  RefinementMode,
} from "./types";

const parseResponseError = async (
  response: Response,
  defaultMessage: string
): Promise<string> => {
  const text = await response.text();
  if (!text) return defaultMessage;
  try {
    const json = JSON.parse(text);
    const detail = json.detail || json.error;
    if (typeof detail === "string") return detail;
    if (typeof detail === "object" && detail !== null) {
      return JSON.stringify(detail);
    }
    return text;
  } catch {
    return text;
  }
};

export const requestGeminiRefinement = async (
  words: TranscriptWord[],
  shorteningMode: RefinementMode,
  options?: GeminiRefinementOptions
): Promise<{ refinement: GeminiRefinement; fileUploadUsed: boolean; rawText: string }> => {
  const geminiProvider = "local";
  const model =
    process.env.NEXT_PUBLIC_LOCAL_LLM_MODEL?.trim() ||
    process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim() ||
    "deepseek-r1:1.5b";

  const proxyBase =
    process.env.NEXT_PUBLIC_GEMINI_PROXY_URL?.replace(/\/$/, "") ?? "";
  const payload: Record<string, unknown> = {
    model,
    words,
    shorteningMode,
    provider: geminiProvider,
  };
  if (options?.variantCount && options.variantCount > 1) {
    payload.variantCount = options.variantCount;
  }

  const response = await fetch(
    `${proxyBase ? proxyBase : ""}/api/gemini-refine`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const message = await parseResponseError(
      response,
      "Gemini transcription refinement request failed."
    );
    throw new Error(message);
  }

  const fileUploadUsed =
    response.headers.get("x-gemini-file-upload") === "true";

  const data = await response.json();

  let parsed: GeminiRefinement | null = null;
  let rawText = "";

  if (
    data &&
    typeof data === "object" &&
    (data.trimmed_text || Array.isArray(data.variants))
  ) {
    parsed = data as GeminiRefinement;
    rawText = JSON.stringify(data);
  } else {
    const candidate = data?.candidates?.[0];
    const aggregatedText = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
          .map((part: { text?: string }) => part?.text ?? "")
          .join("")
          .trim()
      : typeof data?.text === "string"
      ? data.text.trim()
      : candidate?.output_text?.trim?.() ?? (typeof data === "string" ? data : "");

    if (!aggregatedText) {
      throw new Error("Gemini response did not include any text output.");
    }

    rawText = aggregatedText;
    try {
      parsed = JSON.parse(aggregatedText);
    } catch (error) {
      console.error("Gemini raw response", aggregatedText);
      throw new Error("Gemini response was not valid JSON.");
    }
  }

  return {
    // Pass source words so normalize can convert trimmed_text to trimmed_words
    refinement: normalizeGeminiRefinement(parsed!, words),
    fileUploadUsed,
    rawText,
  };
};

export const requestMultiShortFleet = async (
  words: TranscriptWord[]
): Promise<{ shorts: import("./multiShortTypes").ShortClipCandidate[]; rawText: string }> => {
  const geminiProvider = "local";
  const model =
    process.env.NEXT_PUBLIC_LOCAL_LLM_MODEL?.trim() ||
    process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim() ||
    "deepseek-r1:1.5b";

  const proxyBase =
    process.env.NEXT_PUBLIC_GEMINI_PROXY_URL?.replace(/\/$/, "") ?? "";
  const payload = {
    model,
    words,
    shorteningMode: "multi_short",
    provider: geminiProvider,
  };

  const response = await fetch(
    `${proxyBase ? proxyBase : ""}/api/gemini-refine`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const message = await parseResponseError(
      response,
      "Multi-short extraction request failed."
    );
    throw new Error(message);
  }

  const data = await response.json();
  let rawShorts: any[] = [];
  let rawText = "";

  const extractShortsFromObject = (obj: any): any[] => {
    if (!obj || typeof obj !== "object") return [];
    if (Array.isArray(obj)) return obj;
    if (Array.isArray(obj.shorts)) return obj.shorts;
    if (Array.isArray(obj.concepts)) return obj.concepts;
    if (Array.isArray(obj.variants)) return obj.variants;
    if (Array.isArray(obj.clips)) return obj.clips;
    if (obj.trimmed_text) return [obj];
    return [];
  };

  rawShorts = extractShortsFromObject(data);
  if (rawShorts.length > 0) {
    rawText = JSON.stringify(data);
  } else {
    const candidate = data?.candidates?.[0];
    const aggregatedText = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
          .map((part: { text?: string }) => part?.text ?? "")
          .join("")
          .trim()
      : typeof data?.text === "string"
      ? data.text.trim()
      : candidate?.output_text?.trim?.() ?? (typeof data === "string" ? data : "");

    if (aggregatedText) {
      rawText = aggregatedText;
      try {
        const parsed = JSON.parse(aggregatedText);
        rawShorts = extractShortsFromObject(parsed);
      } catch {
        const match = aggregatedText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            rawShorts = extractShortsFromObject(parsed);
          } catch {}
        }
      }
    }
  }

  if (rawShorts.length === 0) {
    throw new Error("Multi-short response did not contain any valid short clip candidates.");
  }
  const processedShorts: import("./multiShortTypes").ShortClipCandidate[] = [];

  rawShorts.forEach((item, idx) => {
    if (!item?.trimmed_text) return;
    const normalized = normalizeGeminiRefinement(
      {
        trimmed_text: item.trimmed_text,
        hook: item.hook,
        notes: item.notes,
        estimated_duration_seconds: item.estimated_duration_seconds,
      },
      words
    );

    const clipWords = normalized.trimmed_words || [];
    const startTime = clipWords.length > 0 ? clipWords[0].start : 0;
    const endTime = clipWords.length > 0 ? clipWords[clipWords.length - 1].end : 0;
    const durationSeconds = Math.max(1, Math.round(endTime - startTime));

    processedShorts.push({
      id: item.id || `short_${idx + 1}`,
      title: item.title || `Short Clip #${idx + 1}`,
      hook: item.hook || normalized.hook || `Viral Moment #${idx + 1}`,
      viralScore: item.viral_score || Math.floor(82 + Math.random() * 16),
      startTime,
      endTime,
      words: clipWords,
      durationSeconds,
      notes: item.notes,
    });
  });

  return {
    shorts: processedShorts,
    rawText: rawText,
  };
};
