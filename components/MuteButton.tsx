"use client";

import { useSyncExternalStore } from "react";
import {
  getMutedSnapshot,
  initAudio,
  setMuted,
  subscribeMute,
} from "@/lib/audio";

/** Sound on/off. Clicking it also counts as the gesture that unlocks audio. */
export default function MuteButton() {
  const muted = useSyncExternalStore(
    subscribeMute,
    getMutedSnapshot,
    () => false, // server render: assume sound on
  );

  return (
    <button
      type="button"
      onClick={() => {
        initAudio();
        setMuted(!muted);
      }}
      aria-label={muted ? "소리 켜기" : "소리 끄기"}
      title={muted ? "소리 켜기" : "소리 끄기"}
      className="absolute right-4 top-4 z-40 rounded-md border-2 border-surface-2 bg-surface/70 px-2 py-2 font-pixel text-[10px] text-muted transition-colors hover:text-bone sm:px-3"
    >
      {/* Shortened on narrow screens so it stays clear of the in-game timer. */}
      <span className="hidden sm:inline">SOUND </span>
      {muted ? "OFF" : "ON"}
    </button>
  );
}
