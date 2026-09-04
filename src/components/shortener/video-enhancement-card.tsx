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
import { Palette, Sparkles, Subtitles, Zap, Sliders, Check } from "lucide-react";

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
    <div className="rounded-xl border bg-card p-4 space-y-4 shadow-sm text-left">
      {/* Header & Hardware Indicator */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              AI Enhancements & Quality
            </p>
            <p className="text-[11px] text-muted-foreground">
              Color grading, captions & GPU hardware acceleration
            </p>
          </div>
        </div>

        {/* Hardware Status Pill */}
        <div
          className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-medium text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
          title="NVIDIA GeForce RTX 3050 hardware video encoding active"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="font-mono font-medium">RTX 3050 NVENC</span>
        </div>
      </div>

      {/* Section 1: AI Color Grading */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-foreground">AI Color Grading</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isAutoGrading ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                AI Grade Active: {COLOR_GRADE_PRESETS[activeColorGrade]?.name || "Cinematic"}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
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
                ? "border-emerald-500/60 bg-emerald-950/60 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.3)] font-semibold"
                : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
            title="Auto-detect mood from transcript and apply optimal 4K color grading"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
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
                    ? "border-indigo-500/60 bg-indigo-950/60 text-indigo-200 shadow-[0_0_8px_rgba(99,102,241,0.25)] font-semibold"
                    : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
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

      {/* Section 2: Caption Highlight & Styling */}
      <div className="space-y-2 border-t border-border/40 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Subtitles className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-foreground">
              Caption & Word Highlight
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
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
                    ? "border-emerald-500/60 bg-emerald-950/50 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.2)] font-semibold"
                    : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: 4K / 1080p Resolution & Hardware Engine */}
      <div className="space-y-2 border-t border-border/40 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Export Resolution</span>
          <span className="text-[10px] font-mono text-muted-foreground">
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
                ? "border-primary bg-primary/15 text-foreground font-semibold shadow-sm"
                : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
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
                ? "border-amber-500/60 bg-amber-950/50 text-amber-200 font-semibold shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>4K Ultra HD</span>
          </button>
        </div>

        {/* Engine Toggle */}
        {onChangeExportEngine && (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 p-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-medium text-foreground">Engine:</span>
              <span className="text-muted-foreground font-mono text-[11px]">
                {exportEngine === "gpu" ? "NVIDIA RTX 3050 NVENC" : "CE.SDK Canvas"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChangeExportEngine("gpu")}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                  exportEngine === "gpu"
                    ? "bg-emerald-600 text-white shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Offload video processing directly to NVIDIA RTX 3050 via hardware NVENC"
              >
                GPU NVENC
              </button>
              <button
                type="button"
                onClick={() => onChangeExportEngine("cesdk")}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                  exportEngine === "cesdk"
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Render inside browser using CE.SDK WebGL engine"
              >
                CE.SDK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoEnhancementCard;
