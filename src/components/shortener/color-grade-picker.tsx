import React, { useState } from "react";
import {
  COLOR_GRADE_PRESETS,
  type ColorGradePresetId,
  type ColorGradeSettings,
} from "@/features/shortener/color-grading";
import { Palette, Sparkles, Sliders, Check, RotateCcw } from "lucide-react";

interface ColorGradePickerProps {
  activePresetId: ColorGradePresetId;
  isAutoGrading: boolean;
  currentSettings: ColorGradeSettings;
  onSelectPreset: (presetId: ColorGradePresetId) => void;
  onToggleAutoGrade: () => void;
  onUpdateSettings: (settings: ColorGradeSettings) => void;
}

export const ColorGradePicker: React.FC<ColorGradePickerProps> = ({
  activePresetId,
  isAutoGrading,
  currentSettings,
  onSelectPreset,
  onToggleAutoGrade,
  onUpdateSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSliders, setShowSliders] = useState(false);

  const presets = Object.values(COLOR_GRADE_PRESETS);

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            activePresetId !== "none"
              ? "border-indigo-500/50 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50"
              : "border-white/15 bg-black/60 text-white hover:bg-black/80"
          }`}
          title="Color Grading & 4K Quality"
        >
          <Palette className="h-3.5 w-3.5 text-indigo-400" />
          <span>
            {isAutoGrading ? "AI Grade (Active)" : COLOR_GRADE_PRESETS[activePresetId]?.name || "Color Grade"}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleAutoGrade}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            isAutoGrading
              ? "border-emerald-500/60 bg-emerald-950/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
              : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
          }`}
          title="Analyze video histogram and automatically normalize exposure, white balance, and 4K sharpness"
        >
          <Sparkles className="h-3 w-3 text-emerald-400" />
          Auto AI
        </button>
      </div>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover Menu */}
          <div className="absolute right-0 mt-2 z-50 w-72 origin-top-right rounded-xl border border-white/10 bg-[#0d1117]/95 p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-semibold text-white">4K Color Grading</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSliders(!showSliders)}
                className={`p-1 rounded text-xs transition ${
                  showSliders ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-white"
                }`}
                title="Fine-tune adjustments"
              >
                <Sliders className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Presets List */}
            <div className="space-y-1">
              {presets.map((preset) => {
                const isSelected = activePresetId === preset.id && !isAutoGrading;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(preset.id);
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      isSelected
                        ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 font-medium"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-[11px] leading-tight text-white flex items-center gap-1.5">
                        {preset.name}
                        {preset.badge && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-slate-300">
                            {preset.badge}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {preset.description}
                      </p>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1.5" />}
                  </button>
                );
              })}
            </div>

            {/* Fine Tuning Sliders (Collapsible) */}
            {showSliders && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Fine Tuning</span>
                  <button
                    type="button"
                    onClick={() => onSelectPreset(activePresetId)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Reset
                  </button>
                </div>

                {/* Exposure */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Exposure</span>
                    <span className="font-mono">{currentSettings.exposure.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.02"
                    value={currentSettings.exposure}
                    onChange={(e) =>
                      onUpdateSettings({ ...currentSettings, exposure: parseFloat(e.target.value) })
                    }
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Contrast</span>
                    <span className="font-mono">{currentSettings.contrast.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-0.2"
                    max="0.5"
                    step="0.02"
                    value={currentSettings.contrast}
                    onChange={(e) =>
                      onUpdateSettings({ ...currentSettings, contrast: parseFloat(e.target.value) })
                    }
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* 4K Sharpness Detail */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>4K Sharpness Detail</span>
                    <span className="font-mono">{currentSettings.sharpness.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.6"
                    step="0.02"
                    value={currentSettings.sharpness}
                    onChange={(e) =>
                      onUpdateSettings({ ...currentSettings, sharpness: parseFloat(e.target.value) })
                    }
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
