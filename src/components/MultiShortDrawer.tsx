import React, { useState } from "react";
import type { ShortClipCandidate } from "@/features/shortener/multiShortTypes";

interface MultiShortDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shorts: ShortClipCandidate[];
  activeClipId: string | null;
  onSelectClip: (short: ShortClipCandidate) => void;
  onExportClip: (short: ShortClipCandidate) => void;
  onExportAll: () => void;
  isExporting: boolean;
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
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const [dockPosition, setDockPosition] = useState<"left" | "right">("left");

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

  // Minimized Widget View (Non-blocking compact floating badge)
  if (isMinimized) {
    return (
      <div
        className={`fixed top-20 ${
          dockPosition === "left" ? "left-4" : "right-4"
        } z-40 flex items-center space-x-2 animate-in fade-in duration-200`}
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="group flex items-center space-x-2.5 px-4 py-2.5 bg-slate-900/90 hover:bg-slate-800/95 text-white rounded-full border border-indigo-500/40 shadow-2xl backdrop-blur-xl transition-all hover:scale-105 hover:border-indigo-400"
          title="Expand Shorts Fleet"
        >
          <span className="text-lg animate-pulse">✂️</span>
          <span className="text-xs font-semibold tracking-wide">
            Shorts Fleet ({shorts.length})
          </span>
          {activeShort && (
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-indigo-500/30">
              #{activeIndex + 1} Active
            </span>
          )}
        </button>
        {shorts.length > 1 && (
          <div className="flex items-center space-x-1 bg-slate-900/90 border border-slate-800 rounded-full p-1 shadow-xl backdrop-blur-xl">
            <button
              onClick={handlePrev}
              className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 text-xs transition-colors"
              title="Previous Clip"
            >
              ◀
            </button>
            <span className="text-[11px] font-mono text-slate-300 px-1">
              {activeIndex + 1}/{shorts.length}
            </span>
            <button
              onClick={handleNext}
              className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 text-xs transition-colors"
              title="Next Clip"
            >
              ▶
            </button>
          </div>
        )}
      </div>
    );
  }

  // Expanded Floating Drawer (Positioned on the left by default so video preview is fully visible)
  return (
    <div
      className={`fixed top-20 ${
        dockPosition === "left" ? "left-4" : "right-4"
      } bottom-6 z-40 w-full max-w-sm bg-slate-950/95 backdrop-blur-xl border border-slate-800/80 shadow-2xl rounded-2xl flex flex-col transition-all duration-300 overflow-hidden ring-1 ring-white/10`}
    >
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <span className="text-base">✂️</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Shorts Fleet
            </h2>
            <p className="text-[11px] text-slate-400">
              {shorts.length} AI Viral Clips Extracted
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() =>
              setDockPosition((prev) => (prev === "left" ? "right" : "left"))
            }
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg text-xs transition-colors"
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
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg text-xs transition-colors"
            title="Minimize panel (unblock preview)"
          >
            🗕
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg text-xs transition-colors"
            title="Close drawer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Action & Quick Navigation Bar */}
      <div className="p-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-2">
        {shorts.length > 1 ? (
          <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={handlePrev}
              className="p-0.5 text-slate-400 hover:text-white transition-colors"
              title="Previous Clip"
            >
              ◀
            </button>
            <span className="text-[11px] font-mono text-slate-300">
              Clip {activeIndex >= 0 ? activeIndex + 1 : 1} of {shorts.length}
            </span>
            <button
              onClick={handleNext}
              className="p-0.5 text-slate-400 hover:text-white transition-colors"
              title="Next Clip"
            >
              ▶
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 font-medium">
            9:16 Vertical Shorts Format
          </span>
        )}

        <button
          onClick={onExportAll}
          disabled={isExporting || shorts.length === 0}
          className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-1 shrink-0"
        >
          <span>⚡ Export All ({shorts.length})</span>
        </button>
      </div>

      {/* Clips List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
        {shorts.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <p className="text-xs">No short clips extracted yet.</p>
            <p className="text-[11px] text-slate-600 mt-1">
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
                    ? "bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-slate-950/80 border-indigo-500/80 shadow-lg shadow-indigo-500/10"
                    : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40"
                }`}
              >
                {/* Viral Badge & Duration */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        short.viralScore >= 90
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      🔥 {short.viralScore}% Viral
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                    <span className="bg-slate-800/90 px-1.5 py-0.5 rounded text-slate-300 font-mono text-[10px]">
                      {short.durationSeconds}s
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {formatTime(short.startTime)} - {formatTime(short.endTime)}
                    </span>
                  </div>
                </div>

                {/* Title & Hook */}
                <h3 className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                  {short.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 italic line-clamp-2 leading-tight">
                  &quot;{short.hook}&quot;
                </p>

                {/* Footer Controls */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    {short.words.length} words
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(short);
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
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
                      className="px-2 py-0.5 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded text-[11px] font-medium transition-colors disabled:opacity-50"
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
