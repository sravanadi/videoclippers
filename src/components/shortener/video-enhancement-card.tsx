import React from "react";
import {
  COLOR_GRADE_PRESETS,
  type ColorGradePresetId,
  type ColorGradeSettings,
} from "@/features/shortener/color-grading";
import {
  CAPTION_STYLE_PRESETS,
  type CaptionStylePresetId,
} from "@/features/shortener/caption-styles";
import { ColorGradePicker } from "./color-grade-picker";
import { Palette, Sparkles, Subtitles, Zap, Sliders } from "lucide-react";

export interface VideoEnhancementCardProps {
  activeColorGrade: ColorGradePresetId;
  isAutoGrading: boolean;
  colorGradeSettings: ColorGradeSettings;
  onSelectColorGrade: (presetId: ColorGradePresetId) => void;
  onToggleAutoGrade: () => void;
  onUpdateColorGradeSettings: (settings: ColorGradeSettings) => void;
  activeCaptionStyle: CaptionStylePresetId;
  onSelectCaptionStyle: (presetId: CaptionStylePresetId) => void;
  exportResolution: "1080p" | "4k";
  onToggleExportResolution: () => void;
  exportEngine?: "gpu" | "cesdk";
  onChangeExportEngine?: (engine: "gpu" | "cesdk") => void;
}

export const VideoEnhancementCard: React.FC<VideoEnhancementCardProps> = ({
  activeColorGrade,
  isAutoGrading,
  colorGradeSettings,
  onSelectColorGrade,
  onToggleAutoGrade,
  onUpdateColorGradeSettings,
  activeCaptionStyle,
  onSelectCaptionStyle,
  exportResolution,
  onToggleExportResolution,
  exportEngine = "gpu",
  onChangeExportEngine,
}) => {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 space-y-4 shadow-xl backdrop-blur-md text-left text-white">
      {/* Header & Hardware Indicator */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              AI Enhancements & Quality
            </p>
            <p className="text-[11px] text-zinc-400">
              Color grading, captions & GPU hardware acceleration
            </p>
          </div>
        </div>

        {/* Hardware Status Pill - Black & White Theme */}
        <div
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm"
          title="NVIDIA GeForce RTX 3050 hardware video encoding active"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
          </span>
          <span className="font-mono font-medium">RTX 3050 NVENC</span>
        </div>
      </div>

      {/* Section 1: Quality & Hardware Engine (Placed upfront for quick access) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Export Quality & Engine</span>
          <span className="text-[10px] font-mono text-zinc-400">
            {exportResolution === "4k" ? "3840x2160 UHD • High Bitrate" : "1920x1080 FHD • Standard"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* 1080p Button */}
          <button
            type="button"
            onClick={() => {
              if (exportResolution !== "1080p") onToggleExportResolution();
            }}
            className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition ${
              exportResolution === "1080p"
                ? "border-white bg-white text-black font-semibold shadow-md"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <span>1080p Full HD</span>
          </button>

          {/* 4K Button */}
          <button
            type="button"
            onClick={() => {
              if (exportResolution !== "4k") onToggleExportResolution();
            }}
            className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition ${
              exportResolution === "4k"
                ? "border-white bg-white text-black font-semibold shadow-md"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>4K Ultra HD</span>
          </button>
        </div>

        {/* Engine Toggle */}
        {onChangeExportEngine && (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-zinc-300" />
              <span className="font-medium text-white">Engine:</span>
              <span className="text-zinc-400 font-mono text-[11px]">
                {exportEngine === "gpu" ? "NVIDIA RTX 3050 NVENC" : "CE.SDK Canvas"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChangeExportEngine("gpu")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                  exportEngine === "gpu"
                    ? "bg-white text-black shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Offload video processing directly to NVIDIA RTX 3050 via hardware NVENC"
              >
                GPU NVENC
              </button>
              <button
                type="button"
                onClick={() => onChangeExportEngine("cesdk")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                  exportEngine === "cesdk"
                    ? "bg-white text-black shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Render inside browser using CE.SDK WebGL engine"
              >
                CE.SDK
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: AI Color Grading */}
      <div className="space-y-2 border-t border-zinc-800/60 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-zinc-300" />
            <span className="text-xs font-semibold text-white">AI Color Grading</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isAutoGrading ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                <Sparkles className="h-2.5 w-2.5" />
                AI Grade Active: {COLOR_GRADE_PRESETS[activeColorGrade]?.name || "Cinematic"}
              </span>
            ) : (
              <span className="text-[11px] text-zinc-400">
                {COLOR_GRADE_PRESETS[activeColorGrade]?.name || "None"}
              </span>
            )}
          </div>
        </div>

        {/* Preset Chips & Auto AI Button */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={onToggleAutoGrade}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              isAutoGrading
                ? "border-white bg-white text-black font-semibold shadow-md"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Auto-detect mood from transcript and apply optimal 4K color grading"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto AI Grade
          </button>

          {Object.values(COLOR_GRADE_PRESETS).slice(0, 5).map((preset) => {
            const isSelected = activeColorGrade === preset.id && !isAutoGrading;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectColorGrade(preset.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? "border-white bg-white text-black font-semibold shadow-sm"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {preset.name}
              </button>
            );
          })}

          <ColorGradePicker
            activePresetId={activeColorGrade}
            isAutoGrading={isAutoGrading}
            currentSettings={colorGradeSettings}
            onSelectPreset={onSelectColorGrade}
            onToggleAutoGrade={onToggleAutoGrade}
            onUpdateSettings={onUpdateColorGradeSettings}
          />
        </div>
      </div>

      {/* Section 3: Manual Post-Processing Adjustments (Sharpen, Noise Reduce, Quality Boost) */}
      <div className="space-y-3 border-t border-zinc-800/60 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-zinc-300" />
            <span className="text-xs font-semibold text-white">
              Manual 4K Adjustments
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateColorGradeSettings({
                ...colorGradeSettings,
                sharpness: 0.25,
                noiseReduction: 0.15,
                qualityIncrease: 0.35,
                exposure: 0.0,
                contrast: 0.1,
                saturation: 0.05,
                temperature: 0.0,
              });
            }}
            className="text-[10px] text-zinc-400 hover:text-white underline underline-offset-2 transition"
            title="Reset manual sliders to balanced 4K defaults"
          >
            Reset Defaults
          </button>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
          {/* Sharpen */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300 font-medium">Sharpening</span>
              <span className="font-mono text-zinc-400 text-[10px]">
                {Math.round((colorGradeSettings.sharpness ?? 0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={colorGradeSettings.sharpness ?? 0}
              onChange={(e) =>
                onUpdateColorGradeSettings({
                  ...colorGradeSettings,
                  sharpness: parseFloat(e.target.value),
                })
              }
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Noise Reduction */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300 font-medium">Noise Reduction</span>
              <span className="font-mono text-zinc-400 text-[10px]">
                {Math.round((colorGradeSettings.noiseReduction ?? 0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={colorGradeSettings.noiseReduction ?? 0}
              onChange={(e) =>
                onUpdateColorGradeSettings({
                  ...colorGradeSettings,
                  noiseReduction: parseFloat(e.target.value),
                })
              }
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Quality Increase / Detail Boost */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300 font-medium">Quality Increase</span>
              <span className="font-mono text-zinc-400 text-[10px]">
                {Math.round((colorGradeSettings.qualityIncrease ?? 0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={colorGradeSettings.qualityIncrease ?? 0}
              onChange={(e) =>
                onUpdateColorGradeSettings({
                  ...colorGradeSettings,
                  qualityIncrease: parseFloat(e.target.value),
                })
              }
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Exposure */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Exposure</span>
              <span className="font-mono text-zinc-400 text-[10px]">
                {(colorGradeSettings.exposure ?? 0).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="-0.5"
              max="0.5"
              step="0.02"
              value={colorGradeSettings.exposure ?? 0}
              onChange={(e) =>
                onUpdateColorGradeSettings({
                  ...colorGradeSettings,
                  exposure: parseFloat(e.target.value),
                })
              }
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Contrast */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Contrast</span>
              <span className="font-mono text-zinc-400 text-[10px]">
                {(colorGradeSettings.contrast ?? 0).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="-0.2"
              max="0.5"
              step="0.02"
              value={colorGradeSettings.contrast ?? 0}
              onChange={(e) =>
                onUpdateColorGradeSettings({
                  ...colorGradeSettings,
                  contrast: parseFloat(e.target.value),
                })
              }
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Saturation */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Saturation</span>
              <span className="font-mono text-zinc-400 text-[10px]">
                {(colorGradeSettings.saturation ?? 0).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="-0.3"
              max="0.5"
              step="0.02"
              value={colorGradeSettings.saturation ?? 0}
              onChange={(e) =>
                onUpdateColorGradeSettings({
                  ...colorGradeSettings,
                  saturation: parseFloat(e.target.value),
                })
              }
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Caption Highlight & Styling */}
      <div className="space-y-2 border-t border-zinc-800/60 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Subtitles className="h-3.5 w-3.5 text-zinc-300" />
            <span className="text-xs font-semibold text-white">
              Caption & Word Highlight
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            {CAPTION_STYLE_PRESETS[activeCaptionStyle]?.name || "Default"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {Object.values(CAPTION_STYLE_PRESETS).map((preset) => {
            const isSelected = activeCaptionStyle === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectCaptionStyle(preset.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? "border-white bg-white text-black font-semibold shadow-sm"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VideoEnhancementCard;
