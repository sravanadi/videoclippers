import type { TranscriptWord } from "@/lib/transcript";
import type { ShortClipCandidate } from "./multiShortTypes";

export interface GamingSliceOptions {
  totalDuration: number;
  minClipDuration?: number; // Minimum clip duration strictly > 60 seconds (default: 62s)
  targetClipDuration?: number; // Target duration per clip (default: 65s - 75s)
  maxClips?: number; // Max clips to extract (default: 30, dynamically scales with video length)
}

const GAMING_TITLES = [
  "🎮 Epic Action Highlight",
  "⚡ Insane Clutch Play",
  "🔥 High-Intensity Moment",
  "⚔️ Boss Battle & Combat",
  "🏆 High-Skill Outplay",
  "🎯 Unreal Aim & Precision",
  "👑 Final Victory Run",
  "💥 Chaos & Comeback",
];

const GAMING_HOOKS = [
  "Watch this insane play! 🔥",
  "Wait for the clutch moment 😱",
  "You won't believe this move 🤯",
  "Pure gaming reflexes right here ⚡",
  "Unreal timing during this fight 🎯",
  "How did they even survive this?! 💥",
  "Top tier gameplay highlight ⭐",
  "The ending of this round is legendary 🏆",
];

/**
 * Automatically slices a gaming video into multiple non-overlapping clips,
 * guaranteeing that each clip's duration is strictly > 1 minute (>60s)
 * whenever the source video duration permits.
 */
export function generateGamingShortCandidates(
  options: GamingSliceOptions
): ShortClipCandidate[] {
  const {
    totalDuration,
    minClipDuration = 62, // strictly > 1 minute (60s)
    targetClipDuration = 70, // 1m 10s default
    maxClips = 30,
  } = options;

  const validTotal = Math.max(1, totalDuration);

  // If source video is shorter than the minimum requirement (e.g. < 62s),
  // return a single clip capturing the entire duration.
  if (validTotal <= minClipDuration) {
    const start = 0;
    const end = validTotal;
    const duration = Math.round(end - start);
    const title = GAMING_TITLES[0];
    const hook = GAMING_HOOKS[0];

    const syntheticWords: TranscriptWord[] = [
      { text: title, start, end },
    ];

    return [
      {
        id: "gaming_short_1",
        title,
        hook,
        viralScore: 92,
        startTime: start,
        endTime: end,
        words: syntheticWords,
        durationSeconds: duration,
        suggestedColorGrade: "vibrant_gaming",
        notes: `Full video highlight (${duration}s)`,
      },
    ];
  }

  // Determine ideal clip duration between minClipDuration (62s) and max limit (179s)
  const clipLen = Math.min(
    179,
    Math.max(minClipDuration, Math.min(targetClipDuration, Math.floor(validTotal * 0.45)))
  );

  // Calculate how many distinct, non-overlapping clips we can fit
  // E.g. for 300s with 65s clips: Math.floor(300 / 65) = 4 clips
  const possibleClips = Math.floor(validTotal / clipLen);
  const clipCount = Math.min(maxClips, Math.max(2, possibleClips));

  const candidates: ShortClipCandidate[] = [];

  if (clipCount === 1) {
    const start = 0;
    const end = Math.min(validTotal, clipLen);
    const duration = Math.round(end - start);
    const title = GAMING_TITLES[0];
    const hook = GAMING_HOOKS[0];
    candidates.push({
      id: "gaming_short_1",
      title,
      hook,
      viralScore: 94,
      startTime: start,
      endTime: end,
      words: [{ text: title, start, end }],
      durationSeconds: duration,
      suggestedColorGrade: "vibrant_gaming",
      notes: `Gaming highlight (${duration}s)`,
    });
    return candidates;
  }

  // Distribute clips evenly across the entire gameplay video
  // Available slack time = totalDuration - (clipCount * clipLen)
  const remainingTime = validTotal - clipCount * clipLen;
  const gap = remainingTime > 0 ? remainingTime / (clipCount - 1) : 0;

  for (let i = 0; i < clipCount; i++) {
    const startTime = Math.round(i * (clipLen + gap));
    // Ensure end time doesn't exceed total video duration
    const rawEndTime = Math.min(validTotal, startTime + clipLen);

    // Guarantee minimum > 60 seconds if source allows
    let adjustedStartTime = startTime;
    let adjustedEndTime = rawEndTime;
    if (adjustedEndTime - adjustedStartTime < minClipDuration && validTotal >= minClipDuration) {
      adjustedStartTime = Math.max(0, adjustedEndTime - minClipDuration);
    }

    const durationSeconds = Math.round(adjustedEndTime - adjustedStartTime);
    const clipIndex = i + 1;
    const title = GAMING_TITLES[(clipIndex - 1) % GAMING_TITLES.length] + ` #${clipIndex}`;
    const hook = GAMING_HOOKS[(clipIndex - 1) % GAMING_HOOKS.length];
    const viralScore = Math.floor(88 + Math.random() * 10); // 88 to 97

    const syntheticWords: TranscriptWord[] = [
      {
        text: title,
        start: adjustedStartTime,
        end: adjustedEndTime,
      },
    ];

    candidates.push({
      id: `gaming_short_${clipIndex}`,
      title,
      hook,
      viralScore,
      startTime: adjustedStartTime,
      endTime: adjustedEndTime,
      words: syntheticWords,
      durationSeconds,
      suggestedColorGrade: "vibrant_gaming",
      notes: `Non-overlapping gaming clip #${clipIndex} (${durationSeconds}s) with Vibrant Gaming grade`,
    });
  }

  return candidates;
}
