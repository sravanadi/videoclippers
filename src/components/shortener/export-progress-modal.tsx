import React from "react";
import { CheckCircle2, Download, Film, Loader2, Sparkles, X } from "lucide-react";

interface ExportProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: number; // 0 - 100
  statusText: string;
  isComplete: boolean;
  error?: string | null;
  clipTitle?: string;
  aspectRatio?: string;
  duration?: number;
  downloadUrl?: string | null;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  onClose,
  progress,
  statusText,
  isComplete,
  error,
  clipTitle = "Short Video Clip",
  aspectRatio = "9:16",
  duration = 30,
  downloadUrl = null,
}) => {
  if (!isOpen) return null;

  const formattedDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]/95 p-6 shadow-2xl transition-all">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              isComplete
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-primary/20 text-primary border-primary/30"
            }`}>
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <Film className="h-5 w-5 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {isComplete ? "Export Complete!" : "Exporting Video Short"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isComplete
                  ? "Your video has been rendered and is ready."
                  : "Rendering frame-by-frame with hardware acceleration"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white transition"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Clip Information Banner */}
        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 flex items-center justify-between">
          <div className="space-y-0.5 max-w-[280px]">
            <p className="text-xs font-medium text-white truncate" title={clipTitle}>
              {clipTitle}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Duration: {formattedDuration(duration)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            {aspectRatio} Format
          </span>
        </div>

        {/* Visual Export Timeline */}
        <div className="mt-6 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-white flex items-center gap-1.5">
              {!isComplete && !error && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              )}
              {isComplete ? "100% Rendered" : statusText || "Processing timeline frames..."}
            </span>
            <span className={`font-mono font-semibold ${isComplete ? "text-emerald-400" : "text-primary"}`}>
              {Math.min(100, Math.max(0, Math.round(progress)))}%
            </span>
          </div>

          {/* Timeline Track with Scrubber & Glow */}
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-black/60 border border-white/10 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-300 relative ${
                isComplete
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                  : "bg-gradient-to-r from-primary/80 via-primary to-emerald-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              }`}
              style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
            >
              {/* Playhead Indicator */}
              <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white rounded-full shadow-[0_0_8px_#ffffff]" />
            </div>

            {/* Timeline Segment Ticks */}
            <div className="absolute inset-0 flex justify-between px-3 pointer-events-none opacity-20">
              <span className="h-full w-px bg-white" />
              <span className="h-full w-px bg-white" />
              <span className="h-full w-px bg-white" />
              <span className="h-full w-px bg-white" />
            </div>
          </div>

          {/* Frame Progress Subtext */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>0:00</span>
            <span>Timeline Progress</span>
            <span>{formattedDuration(duration)}</span>
          </div>
        </div>

        {/* Error Notification if any */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            Export failed: {error}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          {isComplete ? (
            <>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={`${clipTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.mp4`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/10 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Again
                </a>
              )}
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Done
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-white/10 hover:text-white transition"
            >
              Run in background
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
