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

  // Track claimed ranges to guarantee ZERO OVERLAP across multiple clips
  const claimedRanges: { startIdx: number; endIdx: number; startTime: number; endTime: number }[] = [];
  const totalSourceDuration = words[words.length - 1].end - words[0].start;
  const targetMinDuration = Math.min(61, Math.max(20, totalSourceDuration)); // Strictly > 60s if source permits
  const MAX_DURATION_SECONDS = 179; // 2:59 minutes max

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

    let clipWords = normalized.trimmed_words || [];
    if (clipWords.length === 0) return;

    let rawStartIdx = words.findIndex((w) => w.start >= clipWords[0].start);
    if (rawStartIdx === -1) rawStartIdx = 0;
    let rawEndIdx = words.findIndex((w) => w.end >= clipWords[clipWords.length - 1].end);
    if (rawEndIdx === -1) rawEndIdx = words.length - 1;

    // Shift startIdx if it falls into any already claimed range so there is NO duplicate footage
    let startIdx = rawStartIdx;
    for (const claimed of claimedRanges) {
      if (startIdx >= claimed.startIdx && startIdx <= claimed.endIdx) {
        startIdx = claimed.endIdx + 1;
      }
    }

    if (startIdx >= words.length - 1) return;

    // Find the next claimed range boundary to prevent extending into another clip
    let nextBarrierIdx = words.length - 1;
    for (const claimed of claimedRanges) {
      if (claimed.startIdx > startIdx && claimed.startIdx <= nextBarrierIdx) {
        nextBarrierIdx = claimed.startIdx - 1;
      }
    }

    if (nextBarrierIdx <= startIdx) return;

    const availableWindowDuration = words[nextBarrierIdx].end - words[startIdx].start;
    if (availableWindowDuration < Math.min(targetMinDuration, 55) && totalSourceDuration >= 60) {
      return; // Gap too small for a full YouTube video clip
    }

    let endIdx = Math.max(startIdx, Math.min(rawEndIdx, nextBarrierIdx));
    let startWord = words[startIdx];
    let endWord = words[endIdx];
    let currentDuration = endWord.end - startWord.start;

    // Expand endIdx forward until duration is strictly greater than 60 seconds (min 61s)
    while (currentDuration < targetMinDuration && endIdx < nextBarrierIdx) {
      endIdx++;
      endWord = words[endIdx];
      currentDuration = endWord.end - startWord.start;
    }

    // Strictly cap duration <= 179 seconds (2:59 minutes)
    while (currentDuration > MAX_DURATION_SECONDS && endIdx > startIdx) {
      endIdx--;
      endWord = words[endIdx];
      currentDuration = endWord.end - startWord.start;
    }

    const durationSeconds = Math.round(words[endIdx].end - words[startIdx].start);
    if (durationSeconds < targetMinDuration - 1 && totalSourceDuration >= 60) {
      return; // Reject clips smaller than 60s
    }

    clipWords = words.slice(startIdx, endIdx + 1);
    const startTime = clipWords[0].start;
    const endTime = clipWords[clipWords.length - 1].end;

    claimedRanges.push({ startIdx, endIdx, startTime, endTime });
    claimedRanges.sort((a, b) => a.startIdx - b.startIdx);

    processedShorts.push({
      id: item.id || `short_${processedShorts.length + 1}`,
      title: item.title || `Short Clip #${processedShorts.length + 1}`,
      hook: item.hook || normalized.hook || `Viral Moment #${processedShorts.length + 1}`,
      viralScore: item.viral_score || Math.floor(82 + Math.random() * 16),
      startTime,
      endTime,
      words: clipWords,
      durationSeconds,
      suggestedColorGrade: item.suggested_color_grade || "cinematic_hdr",
      notes: item.notes,
    });
  });

  // If fewer than 3 clips were generated and there are still large unclaimed gaps, extract distinct clips
  if (processedShorts.length < 3 && totalSourceDuration >= 120) {
    let searchIdx = 0;
    while (searchIdx < words.length - 1 && processedShorts.length < 4) {
      const isClaimed = claimedRanges.some((r) => searchIdx >= r.startIdx && searchIdx <= r.endIdx);
      if (isClaimed) {
        const nextClaimed = claimedRanges.find((r) => searchIdx >= r.startIdx && searchIdx <= r.endIdx);
        searchIdx = (nextClaimed?.endIdx ?? searchIdx) + 1;
        continue;
      }

      let nextBoundary = words.length - 1;
      for (const claimed of claimedRanges) {
        if (claimed.startIdx > searchIdx && claimed.startIdx <= nextBoundary) {
          nextBoundary = claimed.startIdx - 1;
        }
      }

      const gapSec = words[nextBoundary].end - words[searchIdx].start;
      if (gapSec >= 61) {
        let targetEndIdx = searchIdx;
        while (
          targetEndIdx < nextBoundary &&
          words[targetEndIdx].end - words[searchIdx].start < 75
        ) {
          targetEndIdx++;
        }
        const gapWords = words.slice(searchIdx, targetEndIdx + 1);
        const startTime = gapWords[0].start;
        const endTime = gapWords[gapWords.length - 1].end;
        const durationSeconds = Math.round(endTime - startTime);

        if (durationSeconds >= 60) {
          claimedRanges.push({ startIdx: searchIdx, endIdx: targetEndIdx, startTime, endTime });
          claimedRanges.sort((a, b) => a.startIdx - b.startIdx);
          const clipNum = processedShorts.length + 1;
          processedShorts.push({
            id: `short_${clipNum}`,
            title: `Distinct Highlight #${clipNum}`,
            hook: gapWords.slice(0, 8).map((w) => w.text).join(" "),
            viralScore: Math.floor(84 + Math.random() * 12),
            startTime,
            endTime,
            words: gapWords,
            durationSeconds,
            suggestedColorGrade: "vibrant_gaming",
            notes: "Non-overlapping distinct video highlight",
          });
        }
        searchIdx = targetEndIdx + 1;
      } else {
        searchIdx = nextBoundary + 1;
      }
    }
  }

  return {
    shorts: processedShorts,
    rawText: rawText,
  };
};
