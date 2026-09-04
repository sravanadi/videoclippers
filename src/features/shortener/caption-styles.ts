/**
 * Multi-Captions Styling Engine
 * Provides modern short-form viral caption styles:
 * - Karaoke Word-by-Word Highlight (Hormozi / MrBeast style)
 * - TikTok Bold Punch (All-Caps punchy center)
 * - Clean Minimal Subtitles (Subtle lower-third pill)
 * - Cyberpunk / Gaming Yellow
 */

import type { TranscriptWord } from "@/lib/transcript";

export type CaptionStylePresetId =
  | "karaoke_highlight"
  | "tiktok_bold"
  | "clean_minimal"
  | "cyberpunk_gaming"
  | "none";

export interface CaptionStylePreset {
  id: CaptionStylePresetId;
  name: string;
  description: string;
  badge: string;
  wordsPerSegment: number;
  uppercase: boolean;
  textColor: { r: number; g: number; b: number; a: number };
  highlightColor: { r: number; g: number; b: number; a: number };
  strokeColor?: { r: number; g: number; b: number; a: number };
  strokeWidth?: number;
  backgroundColor?: { r: number; g: number; b: number; a: number };
  fontSizeMax: number;
  fontSizeMin: number;
  posY: number; // Percent from top
}

export const CAPTION_STYLE_PRESETS: Record<CaptionStylePresetId, CaptionStylePreset> = {
  karaoke_highlight: {
    id: "karaoke_highlight",
    name: "Karaoke Highlight",
    description: "Viral 2-3 word segments with vibrant yellow active word highlight and heavy black outline.",
    badge: "Viral #1",
    wordsPerSegment: 3,
    uppercase: true,
    textColor: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }, // White
    highlightColor: { r: 1.0, g: 0.9, b: 0.0, a: 1.0 }, // Neon Yellow
    strokeColor: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    strokeWidth: 3,
    fontSizeMax: 48,
    fontSizeMin: 18,
    posY: 0.73,
  },
  tiktok_bold: {
    id: "tiktok_bold",
    name: "TikTok / Reels Bold",
    description: "Punchy, bold uppercase captions centered on screen with high contrast shadow.",
    badge: "Trending",
    wordsPerSegment: 4,
    uppercase: true,
    textColor: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    highlightColor: { r: 0.2, g: 0.9, b: 0.4, a: 1.0 }, // Emerald Green
    strokeColor: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
    strokeWidth: 4,
    fontSizeMax: 44,
    fontSizeMin: 16,
    posY: 0.70,
  },
  clean_minimal: {
    id: "clean_minimal",
    name: "Clean Subtitles",
    description: "Classic subtitle sentences with a translucent dark pill background, ideal for long-form gameplay.",
    badge: "Clean",
    wordsPerSegment: 8,
    uppercase: false,
    textColor: { r: 0.95, g: 0.95, b: 0.98, a: 1.0 },
    highlightColor: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    backgroundColor: { r: 0.0, g: 0.0, b: 0.0, a: 0.65 },
    fontSizeMax: 34,
    fontSizeMin: 14,
    posY: 0.80,
  },
  cyberpunk_gaming: {
    id: "cyberpunk_gaming",
    name: "Cyberpunk Gaming",
    description: "High-energy gaming aesthetic with neon cyan and yellow contrast.",
    badge: "Gaming",
    wordsPerSegment: 3,
    uppercase: true,
    textColor: { r: 0.1, g: 0.95, b: 0.95, a: 1.0 }, // Neon Cyan
    highlightColor: { r: 1.0, g: 0.85, b: 0.1, a: 1.0 }, // Gold Yellow
    strokeColor: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    strokeWidth: 3,
    fontSizeMax: 46,
    fontSizeMin: 16,
    posY: 0.72,
  },
  none: {
    id: "none",
    name: "Off (No Captions)",
    description: "Hide all captions from the video.",
    badge: "Off",
    wordsPerSegment: 5,
    uppercase: false,
    textColor: { r: 1, g: 1, b: 1, a: 1 },
    highlightColor: { r: 1, g: 1, b: 1, a: 1 },
    fontSizeMax: 80,
    fontSizeMin: 20,
    posY: 0.70,
  },
};

export interface StyledCaptionSegment {
  text: string;
  start: number;
  end: number;
  duration: number;
  words: TranscriptWord[];
}

/**
 * Chunks transcript words into styled caption segments based on selected preset
 */
export function chunkWordsByCaptionStyle(
  words: TranscriptWord[],
  presetId: CaptionStylePresetId
): StyledCaptionSegment[] {
  if (!words.length || presetId === "none") return [];

  const preset = CAPTION_STYLE_PRESETS[presetId] || CAPTION_STYLE_PRESETS.karaoke_highlight;
  const maxWords = preset.wordsPerSegment;
  const segments: StyledCaptionSegment[] = [];

  let currentChunk: TranscriptWord[] = [];

  const flushChunk = () => {
    if (!currentChunk.length) return;
    const start = currentChunk[0].start;
    const end = currentChunk[currentChunk.length - 1].end;
    let rawText = currentChunk.map((w) => w.text).join(" ").trim();
    if (preset.uppercase) {
      rawText = rawText.toUpperCase();
    }

    segments.push({
      text: rawText,
      start,
      end,
      duration: Math.max(0.2, end - start),
      words: [...currentChunk],
    });
    currentChunk = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentChunk.push(word);

    const isSentenceBreak = /[.!?]$/.test(word.text.trim());
    const nextWord = words[i + 1];
    const hasLongPause = nextWord && nextWord.start - word.end > 0.4;

    if (currentChunk.length >= maxWords || isSentenceBreak || hasLongPause) {
      flushChunk();
    }
  }

  flushChunk();
  return segments;
}
