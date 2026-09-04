import Link from "next/link";
import { Sparkles, Scissors } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  onLogoClick?: () => void;
  onOpenShortsFleet?: () => void;
  shortsCount?: number;
};

const AppHeader = ({ onLogoClick, onOpenShortsFleet, shortsCount }: AppHeaderProps) => (
  <header className="border-b">
    <div className="container flex h-16 items-center justify-between gap-4">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-semibold tracking-tight transition hover:text-foreground/80"
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }
          onLogoClick?.();
        }}
      >
        <Sparkles className="h-5 w-5 text-primary" />
        VideoClipper
      </Link>
      <div className="flex items-center gap-3">
        {Boolean(shortsCount && shortsCount > 0) && (
          <Button
            type="button"
            size="sm"
            onClick={onOpenShortsFleet}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
          >
            <Scissors className="h-3.5 w-3.5" />
            Shorts Fleet ({shortsCount})
          </Button>
        )}
        <ThemeToggle />
      </div>
    </div>
  </header>
);

export default AppHeader;
