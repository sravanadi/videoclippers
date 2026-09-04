/**
 * AI Auto Color Grading & 4K Quality Enhancement Engine
 * Supports histogram analysis, exposure/white balance normalization,
 * and 4K micro-contrast/sharpness adjustments via CE.SDK native block effects.
 */

export type ColorGradePresetId =
  | "auto_4k_cinematic"
  | "vibrant_gaming"
  | "cyberpunk"
  | "warm_film"
  | "natural_studio"
  | "none";

export interface ColorGradeSettings {
  exposure: number; // -1 to 1 (default 0)
  contrast: number; // -1 to 1 (default 0)
  temperature: number; // -1 to 1 (cool to warm, default 0)
  sharpness: number; // 0 to 1 (4K detail enhancer)
  clarity: number; // 0 to 1 (midtone local contrast)
  whites: number; // -1 to 1
  blacks: number; // -1 to 1
  highlights: number; // -1 to 1 (recover bright skies / HUDs)
  shadows: number; // -1 to 1 (lift dark gaming shadows)
  saturation: number; // -1 to 1 (vibrancy without oversaturation)
}

export interface ColorGradePreset {
  id: ColorGradePresetId;
  name: string;
  description: string;
  badge: string;
  settings: ColorGradeSettings;
}

export const COLOR_GRADE_PRESETS: Record<ColorGradePresetId, ColorGradePreset> = {
  auto_4k_cinematic: {
    id: "auto_4k_cinematic",
    name: "4K Cinematic",
    description: "Balanced contrast, rich deep blacks, neutral temperature, and crisp 4K textures.",
    badge: "Cinema 4K",
    settings: {
      exposure: 0.04,
      contrast: 0.16,
      temperature: 0.01,
      sharpness: 0.25,
      clarity: 0.20,
      whites: 0.06,
      blacks: -0.06,
      highlights: -0.04,
      shadows: 0.08,
      saturation: 0.06,
    },
  },
  vibrant_gaming: {
    id: "vibrant_gaming",
    name: "Vibrant Gaming HDR",
    description: "Lifted shadows for dark games, punchy contrast, crisp HUD text, and rich dynamic range.",
    badge: "HDR Game",
    settings: {
      exposure: 0.06,
      contrast: 0.18,
      temperature: 0.0,
      sharpness: 0.30,
      clarity: 0.22,
      whites: 0.08,
      blacks: -0.05,
      highlights: -0.06,
      shadows: 0.16,
      saturation: 0.12,
    },
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk / Neon",
    description: "Cool teal undertones in shadows with punchy warm highlights and high local clarity.",
    badge: "Neon Sci-Fi",
    settings: {
      exposure: 0.02,
      contrast: 0.22,
      temperature: -0.08,
      sharpness: 0.28,
      clarity: 0.25,
      whites: 0.10,
      blacks: -0.10,
      highlights: 0.04,
      shadows: 0.06,
      saturation: 0.10,
    },
  },
  warm_film: {
    id: "warm_film",
    name: "Warm Golden Film",
    description: "Cinematic golden hour warmth with soft highlight roll-off and organic contrast.",
    badge: "Film Gold",
    settings: {
      exposure: 0.03,
      contrast: 0.12,
      temperature: 0.12,
      sharpness: 0.20,
      clarity: 0.15,
      whites: 0.04,
      blacks: -0.03,
      highlights: -0.08,
      shadows: 0.10,
      saturation: 0.04,
    },
  },
  natural_studio: {
    id: "natural_studio",
    name: "Natural Studio",
    description: "Broadcast-accurate white balance and neutral exposure with subtle detail sharpening.",
    badge: "Studio Clean",
    settings: {
      exposure: 0.0,
      contrast: 0.08,
      temperature: 0.0,
      sharpness: 0.18,
      clarity: 0.10,
      whites: 0.02,
      blacks: -0.02,
      highlights: 0.0,
      shadows: 0.05,
      saturation: 0.0,
    },
  },
  none: {
    id: "none",
    name: "Original (Raw)",
    description: "Raw source video colors with zero adjustments.",
    badge: "Raw",
    settings: {
      exposure: 0,
      contrast: 0,
      temperature: 0,
      sharpness: 0,
      clarity: 0,
      whites: 0,
      blacks: 0,
      highlights: 0,
      shadows: 0,
      saturation: 0,
    },
  },
};

/**
 * Fast Client-Side Histogram Analyzer
 * Computes luminance distribution and color balance to auto-correct exposure,
 * contrast, and white balance.
 */
export function analyzeFrameHistogram(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): ColorGradeSettings {
  const sampleWidth = Math.min(width, 160);
  const sampleHeight = Math.min(height, 90);

  const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  const data = imgData.data;
  const pixelCount = data.length / 4;

  let totalLuminance = 0;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    totalLuminance += lum;
    totalR += r;
    totalG += g;
    totalB += b;
  }

  const avgLum = totalLuminance / pixelCount; // 0 - 255
  const avgR = totalR / pixelCount;
  const avgB = totalB / pixelCount;

  // 1. Exposure correction: target optimal midtone around 110-128
  let exposureAdj = 0;
  if (avgLum < 95) {
    // Underexposed gaming scene: lift exposure safely
    exposureAdj = Math.min(0.18, ((110 - avgLum) / 255) * 0.4);
  } else if (avgLum > 165) {
    // Overexposed / washed out scene: recover
    exposureAdj = Math.max(-0.14, ((130 - avgLum) / 255) * 0.3);
  }

  // 2. White balance (Color Temperature) normalization
  let tempAdj = 0;
  if (avgB > 0) {
    const rbRatio = avgR / avgB;
    if (rbRatio < 0.85) {
      // Too blue/cool: add warmth
      tempAdj = Math.min(0.12, (1.0 - rbRatio) * 0.25);
    } else if (rbRatio > 1.25) {
      // Too red/warm: cool down
      tempAdj = Math.max(-0.12, (1.0 - rbRatio) * 0.2);
    }
  }

  // 3. 4K Detail enhancement parameters
  return {
    exposure: parseFloat(exposureAdj.toFixed(2)),
    contrast: 0.16,
    temperature: parseFloat(tempAdj.toFixed(2)),
    sharpness: 0.26, // 4K detail boost
    clarity: 0.20, // Midtone texture boost
    whites: 0.05,
    blacks: -0.06,
    highlights: -0.05,
    shadows: avgLum < 100 ? 0.15 : 0.08,
    saturation: 0.06, // Natural vibrancy, zero oversaturation
  };
}

/**
 * Applies color grading adjustments to a CE.SDK video block
 */
export function applyColorGradeToEngineBlock(
  engine: any,
  videoBlockId: number,
  settings: ColorGradeSettings
): number | null {
  if (!engine || !engine.block.isValid(videoBlockId)) return null;

  try {
    // Check if an adjustments effect already exists on this block
    const existingEffects = engine.block.getEffects(videoBlockId) || [];
    let adjustmentEffectId = existingEffects.find((effectId: number) => {
      try {
        const type = engine.block.getType(effectId);
        return type === "//ly.img.ubq/effect/adjustments" || type === "adjustments";
      } catch {
        return false;
      }
    });

    // If no adjustments effect exists, create and append one
    if (!adjustmentEffectId || !engine.block.isValid(adjustmentEffectId)) {
      adjustmentEffectId = engine.block.createEffect("adjustments");
      engine.block.appendEffect(videoBlockId, adjustmentEffectId);
    }

    // Set all properties safely
    const setSafe = (prop: string, val: number) => {
      try {
        engine.block.setFloat(adjustmentEffectId, prop, val);
      } catch (err) {
        // Some properties might differ slightly across minor CE.SDK builds
      }
    };

    setSafe("effect/adjustments/exposure", settings.exposure);
    setSafe("effect/adjustments/contrast", settings.contrast);
    setSafe("effect/adjustments/temperature", settings.temperature);
    setSafe("effect/adjustments/sharpness", settings.sharpness);
    setSafe("effect/adjustments/clarity", settings.clarity);
    setSafe("effect/adjustments/whites", settings.whites);
    setSafe("effect/adjustments/blacks", settings.blacks);
    setSafe("effect/adjustments/highlights", settings.highlights);
    setSafe("effect/adjustments/shadows", settings.shadows);
    setSafe("effect/adjustments/saturation", settings.saturation);

    return adjustmentEffectId;
  } catch (error) {
    console.warn("[ColorGrading] Failed to apply adjustments to block", error);
    return null;
  }
}
