import React, { useState } from "react";
import type { ShortClipCandidate } from "@/features/shortener/multiShortTypes";
import {
  COLOR_GRADE_PRESETS,
  type ColorGradePresetId,
  type ColorGradeSettings,
} from "@/features/shortener/color-grading";
import {
  CAPTION_STYLE_PRESETS,
  type CaptionStylePresetId,
} from "@/features/shortener/caption-styles";
import {
  Sliders,
  Palette,
  Sparkles,
  Subtitles,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface MultiShortDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shorts: ShortClipCandidate[];
  activeClipId: string | null;
  onSelectClip: (short: ShortClipCandidate) => void;
  onExportClip: (short: ShortClipCandidate) => void;
  onExportAll: () => void;
  isExporting: boolean;
  // Enhancement & Quality Controls
  activeColorGrade?: ColorGradePresetId;
  isAutoGrading?: boolean;
  colorGradeSettings?: ColorGradeSettings;
  onSelectColorGrade?: (presetId: ColorGradePresetId) => void;
  onToggleAutoGrade?: () => void;
  onUpdateColorGradeSettings?: (settings: ColorGradeSettings) => void;
  activeCaptionStyle?: CaptionStylePresetId;
  onSelectCaptionStyle?: (presetId: CaptionStylePresetId) => void;
  exportResolution?: "1080p" | "4k";
  onToggleExportResolution?: () => void;
  exportEngine?: "gpu" | "cesdk";
  onChangeExportEngine?: (engine: "gpu" | "cesdk") => void;
}

export const MultiShortDrawer: React.FC<MultiShortDrawerProps> = ({
  isOpen,
  onClose,
  shorts,
  activeClipId,
  onSelectClip,
  onExportClip,
  onExportAll,
  isExporting,
  activeColorGrade = "none",
  isAutoGrading = false,
  onSelectColorGrade,
  onToggleAutoGrade,
  activeCaptionStyle = "karaoke_highlight",
  onSelectCaptionStyle,
  exportResolution = "1080p",
  onToggleExportResolution,
  exportEngine = "gpu",
  onChangeExportEngine,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [dockPosition, setDockPosition] = useState<"left" | "right">("left");
  const [showEnhancementPanel, setShowEnhancementPanel] = useState(false);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const activeIndex = shorts.findIndex((s) => s.id === activeClipId);
  const activeShort = activeIndex >= 0 ? shorts[activeIndex] : null;

  const handlePrev = () => {
    if (shorts.length === 0) return;
    const prevIdx = activeIndex > 0 ? activeIndex - 1 : shorts.length - 1;
    onSelectClip(shorts[prevIdx]);
  };

  const handleNext = () => {
    if (shorts.length === 0) return;
    const nextIdx = activeIndex < shorts.length - 1 ? activeIndex + 1 : 0;
    onSelectClip(shorts[nextIdx]);
  };

  // Minimized Widget View (Compact Black & White floating badge)
  if (isMinimized) {
    return (
      <div
        className={`fixed top-20 ${
          dockPosition === "left" ? "left-4" : "right-4"
        } z-40 flex items-center space-x-2 animate-in fade-in duration-200`}
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="group flex items-center space-x-2.5 px-4 py-2 bg-zinc-950/95 hover:bg-zinc-900 text-white rounded-full border border-zinc-800 shadow-2xl backdrop-blur-xl transition-all hover:scale-105 hover:border-zinc-700"
          title="Expand Shorts Fleet"
        >
          <span className="text-base">✂️</span>
          <span className="text-xs font-semibold tracking-wide">
            Shorts Fleet ({shorts.length})
          </span>
          {activeShort && (
            <span className="bg-white/10 text-white text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/20">
              #{activeIndex + 1} Active
            </span>
          )}
        </button>
        {shorts.length > 1 && (
          <div className="flex items-center space-x-1 bg-zinc-950/95 border border-zinc-800 rounded-full p-1 shadow-xl backdrop-blur-xl">
            <button
              onClick={handlePrev}
              className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 text-xs transition-colors"
              title="Previous Clip"
            >
              ◀
            </button>
            <span className="text-[11px] font-mono text-zinc-300 px-1">
              {activeIndex + 1}/{shorts.length}
            </span>
            <button
              onClick={handleNext}
              className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 text-xs transition-colors"
              title="Next Clip"
            >
              ▶
            </button>
          </div>
        )}
      </div>
    );
  }

  // Expanded Floating Drawer (Black & White Luxury Monochrome Theme)
  return (
    <div
      className={`fixed top-20 ${
        dockPosition === "left" ? "left-4" : "right-4"
      } bottom-6 z-40 w-full max-w-sm bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800 shadow-2xl rounded-2xl flex flex-col transition-all duration-300 overflow-hidden ring-1 ring-white/10 text-white`}
    >
      {/* Header */}
      <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-white/10 rounded-lg border border-white/15 text-white flex items-center justify-center">
            <span className="text-base">✂️</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Shorts Fleet
            </h2>
            <p className="text-[11px] text-zinc-400">
              {shorts.length} AI Viral Clips Extracted
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() =>
              setDockPosition((prev) => (prev === "left" ? "right" : "left"))
            }
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-xs transition-colors"
            title={
              dockPosition === "left"
                ? "Dock to Right"
                : "Dock to Left (unblock preview)"
            }
          >
            {dockPosition === "left" ? "👉" : "👈"}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-xs transition-colors"
            title="Minimize panel"
          >
            🗕
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-xs transition-colors"
            title="Close drawer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Integrated AI Enhancement & Quality Bar (Rearranged inside Shorts Fleet window) */}
      <div className="border-b border-zinc-800/80 bg-zinc-900/30">
        <div
          onClick={() => setShowEnhancementPanel((prev) => !prev)}
          className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-zinc-900/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sliders className="h-3.5 w-3.5 text-zinc-300" />
            <span className="text-xs font-semibold text-white">
              AI Enhancements & Quality
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-black font-semibold">
              {exportResolution.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/20 bg-white/5 text-zinc-300">
              {exportEngine === "gpu" ? "RTX 3050" : "CE.SDK"}
            </span>
            {showEnhancementPanel ? (
              <ChevronUp className="h-3.5 w-3.5 text-zinc-400 ml-0.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400 ml-0.5" />
            )}
          </div>
        </div>

        {/* Collapsible Panel for Quality & AI Enhancement */}
        {showEnhancementPanel && (
          <div className="p-3 pt-1 space-y-3 border-t border-zinc-800/60 bg-zinc-950/60 animate-in fade-in duration-150">
            {/* Resolution Toggle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Output Resolution</span>
                <span className="font-mono text-[10px]">
                  {exportResolution === "4k" ? "3840x2160 UHD" : "1920x1080 FHD"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (exportResolution !== "1080p" && onToggleExportResolution) {
                      onToggleExportResolution();
                    }
                  }}
                  className={`py-1 px-2 rounded-lg border text-xs font-medium transition ${
                    exportResolution === "1080p"
                      ? "border-white bg-white text-black font-semibold shadow-sm"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  1080p Full HD
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (exportResolution !== "4k" && onToggleExportResolution) {
                      onToggleExportResolution();
                    }
                  }}
                  className={`py-1 px-2 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1 ${
                    exportResolution === "4k"
                      ? "border-white bg-white text-black font-semibold shadow-sm"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  4K Ultra HD
                </button>
              </div>
            </div>

            {/* AI Color Grading Chips */}
            {onSelectColorGrade && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Palette className="h-3 w-3" /> AI Color Grading
                  </span>
                  {isAutoGrading && (
                    <span className="text-[10px] font-semibold text-white">Auto Active</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {onToggleAutoGrade && (
                    <button
                      type="button"
                      onClick={onToggleAutoGrade}
                      className={`px-2 py-0.5 rounded-md border text-[11px] transition ${
                        isAutoGrading
                          ? "border-white bg-white text-black font-semibold"
                          : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      ✨ Auto AI
                    </button>
                  )}
                  {Object.values(COLOR_GRADE_PRESETS).slice(0, 4).map((preset) => {
                    const isSelected = activeColorGrade === preset.id && !isAutoGrading;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelectColorGrade(preset.id)}
                        className={`px-2 py-0.5 rounded-md border text-[11px] transition ${
                          isSelected
                            ? "border-white bg-white text-black font-semibold shadow-sm"
                            : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Captions Style Chips */}
            {onSelectCaptionStyle && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Subtitles className="h-3 w-3" /> Caption Styling
                  </span>
                  <span className="font-mono text-[10px]">
                    {CAPTION_STYLE_PRESETS[activeCaptionStyle as CaptionStylePresetId]?.name || "Default"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.values(CAPTION_STYLE_PRESETS).map((preset) => {
                    const isSelected = activeCaptionStyle === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelectCaptionStyle(preset.id)}
                        className={`px-2 py-0.5 rounded-md border text-[11px] transition ${
                          isSelected
                            ? "border-white bg-white text-black font-semibold shadow-sm"
                            : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Engine Toggle */}
            {onChangeExportEngine && (
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs">
                <div className="flex items-center gap-1 text-zinc-400">
                  <Zap className="h-3 w-3" />
                  <span>Hardware Engine:</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onChangeExportEngine("gpu")}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      exportEngine === "gpu"
                        ? "bg-white text-black font-semibold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    RTX 3050 NVENC
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeExportEngine("cesdk")}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      exportEngine === "cesdk"
                        ? "bg-white text-black font-semibold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    CE.SDK
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action & Quick Navigation Bar */}
      <div className="p-2.5 bg-zinc-900/50 border-b border-zinc-800/80 flex items-center justify-between gap-2">
        {shorts.length > 1 ? (
          <div className="flex items-center space-x-1.5 bg-zinc-950/80 px-2 py-1 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={handlePrev}
              className="p-0.5 text-zinc-400 hover:text-white transition-colors"
              title="Previous Clip"
            >
              ◀
            </button>
            <span className="text-[11px] font-mono text-zinc-300">
              Clip {activeIndex >= 0 ? activeIndex + 1 : 1} of {shorts.length}
            </span>
            <button
              onClick={handleNext}
              className="p-0.5 text-zinc-400 hover:text-white transition-colors"
              title="Next Clip"
            >
              ▶
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-400 font-medium">
            9:16 Vertical Shorts Format
          </span>
        )}

        <button
          onClick={onExportAll}
          disabled={isExporting || shorts.length === 0}
          className="px-3 py-1.5 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black rounded-lg text-xs font-semibold shadow-md transition-all flex items-center space-x-1 shrink-0"
        >
          <span>⚡ Export All ({shorts.length})</span>
        </button>
      </div>

      {/* Clips List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-zinc-800">
        {shorts.length === 0 ? (
          <div className="text-center py-10 text-zinc-500">
            <p className="text-xs">No short clips extracted yet.</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Click &quot;Generate Shorts Fleet&quot; to scan your full video.
            </p>
          </div>
        ) : (
          shorts.map((short, idx) => {
            const isActive = activeClipId === short.id;
            return (
              <div
                key={short.id}
                onClick={() => onSelectClip(short)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? "bg-zinc-900 border-white/40 shadow-xl ring-1 ring-white/20"
                    : "bg-zinc-950/50 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/40"
                }`}
              >
                {/* Viral Badge & Duration */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/20 bg-white/10 text-white">
                      🔥 {short.viralScore}% Viral
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px]">
                    <span
                      className="border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 rounded text-zinc-200 font-mono text-[10px] font-semibold"
                      title="YouTube Ready Duration (1:00 - 2:59)"
                    >
                      ⏱ {formatTime(short.durationSeconds)} (YT)
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {formatTime(short.startTime)} - {formatTime(short.endTime)}
                    </span>
                  </div>
                </div>

                {/* Title & Hook */}
                <h3 className="text-xs font-semibold text-white group-hover:text-zinc-100 transition-colors line-clamp-1">
                  {short.title}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5 italic line-clamp-2 leading-tight">
                  &quot;{short.hook}&quot;
                </p>
                {short.suggestedColorGrade && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[9px] uppercase font-mono tracking-wider text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                      🎨 {short.suggestedColorGrade.replace(/_/g, " ")}
                    </span>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {short.words.length} words
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(short);
                      }}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        isActive
                          ? "bg-white text-black font-semibold shadow-sm"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                      }`}
                    >
                      {isActive ? "✓ Active" : "Preview"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportClip(short);
                      }}
                      disabled={isExporting}
                      className="px-2.5 py-0.5 bg-white hover:bg-zinc-200 text-black rounded text-[11px] font-semibold transition-colors disabled:opacity-50 shadow-sm"
                    >
                      Export
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

