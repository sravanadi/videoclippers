import React, { useState } from "react";
import {
  CAPTION_STYLE_PRESETS,
  type CaptionStylePresetId,
} from "@/features/shortener/caption-styles";
import { Subtitles, Check, Sparkles } from "lucide-react";

interface CaptionStylePickerProps {
  activePresetId: CaptionStylePresetId;
  onSelectPreset: (presetId: CaptionStylePresetId) => void;
}

export const CaptionStylePicker: React.FC<CaptionStylePickerProps> = ({
  activePresetId,
  onSelectPreset,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const presets = Object.values(CAPTION_STYLE_PRESETS);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          activePresetId !== "none"
            ? "border-white bg-white text-black font-semibold shadow-sm hover:bg-zinc-200"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
        }`}
        title="Styled Captions"
      >
        <Subtitles className="h-3.5 w-3.5" />
        <span>{CAPTION_STYLE_PRESETS[activePresetId]?.name || "Captions"}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover Menu - Black & White Theme */}
          <div className="absolute right-0 mt-2 z-50 w-72 origin-top-right rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Subtitles className="h-4 w-4 text-white" />
                <span className="text-xs font-semibold text-white">Multi-Caption Styles</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Auto-Sync</span>
            </div>

            <div className="space-y-1">
              {presets.map((preset) => {
                const isSelected = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(preset.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      isSelected
                        ? "bg-white text-black font-semibold shadow-sm"
                        : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    }`}
                  >
                    <div>
                      <p className={`font-medium text-[11px] leading-tight flex items-center gap-1.5 ${isSelected ? "text-black font-bold" : "text-white"}`}>
                        {preset.name}
                        {preset.badge && (
                          <span className={`text-[9px] font-mono px-1 py-0.2 rounded ${isSelected ? "bg-black/10 text-black" : "bg-white/10 text-zinc-300"}`}>
                            {preset.badge}
                          </span>
                        )}
                      </p>
                      <p className={`text-[10px] line-clamp-1 mt-0.5 ${isSelected ? "text-zinc-700" : "text-zinc-400"}`}>
                        {preset.description}
                      </p>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-black shrink-0 ml-1.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
