import type { HandSortMode } from "@kazhutha/shared";
import { useEffect, useRef, useState } from "react";

interface Props {
  sortMode: HandSortMode;
  onSortModeChange: (mode: HandSortMode) => void;
  countVisible: boolean;
  onCountVisibleChange: (visible: boolean) => void;
  showCountToggle: boolean;
  soundMuted: boolean;
  onSoundMutedChange: (muted: boolean) => void;
}

function PreferencesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.06 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function HandPreferences({
  sortMode,
  onSortModeChange,
  countVisible,
  onCountVisibleChange,
  showCountToggle,
  soundMuted,
  onSoundMutedChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Hand preferences"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-700"
      >
        <PreferencesIcon />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Hand preferences"
          className="absolute bottom-full right-0 z-30 mb-2 w-52 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Arrangement</p>
          <div
            className="mb-3 inline-flex w-full rounded-full border border-neutral-200 bg-neutral-50 p-0.5 text-[11px]"
            role="group"
            aria-label="Hand sort order"
          >
            {(["suit", "value"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSortModeChange(mode)}
                aria-pressed={sortMode === mode}
                className={`flex-1 rounded-full px-2 py-1 capitalize transition-colors ${
                  sortMode === mode ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          {showCountToggle && (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Visibility</p>
              <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 text-sm text-neutral-700">
                <span>Show card count</span>
                <input
                  type="checkbox"
                  checked={countVisible}
                  onChange={(e) => onCountVisibleChange(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                />
              </label>
            </>
          )}
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Audio</p>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-neutral-700">
            <span>Sound effects</span>
            <input
              type="checkbox"
              checked={!soundMuted}
              onChange={(e) => onSoundMutedChange(!e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
            />
          </label>
        </div>
      )}
    </div>
  );
}
