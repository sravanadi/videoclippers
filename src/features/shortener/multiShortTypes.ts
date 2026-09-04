import type { TranscriptWord } from "@/lib/transcript";

export interface RawShortCandidate {
  id?: string;
  title?: string;
  hook?: string;
  viral_score?: number;
  trimmed_text: string;
  estimated_duration_seconds?: number;
  notes?: string;
}

export interface ShortClipCandidate {
  id: string;
  title: string;
  hook: string;
  viralScore: number;
  startTime: number;
  endTime: number;
  words: TranscriptWord[];
  durationSeconds: number;
  notes?: string;
}

export interface MultiShortFleetResult {
  shorts: ShortClipCandidate[];
  rawText: string;
}
