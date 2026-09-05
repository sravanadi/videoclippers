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
  mode === "multi_short" ||
  mode === "gaming";

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

const buildTranscriptText = (sourceWords) => {
  if (!Array.isArray(sourceWords)) return "";
  const parts = [];
  sourceWords.forEach((word, index) => {
    const text = (
      typeof word?.text === "string"
        ? word.text
        : typeof word?.word === "string"
        ? word.word
        : ""
    ).trim();
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
      requestedModel: model,
      instructions,
      transcriptText,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Local AI Router generation failed", detail: result.detail },
        { status: result.status || 500 }
      );
    }

    const response = NextResponse.json(result.data);
    response.headers.set("x-omni-router-provider", result.provider || "local");
    response.headers.set("x-omni-router-model", result.model || "deepseek-r1:1.5b");
    return response;
  } catch (error) {
    console.error("[Local AI Router Error]", error);
    return NextResponse.json(
      {
        error: "Server error",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
