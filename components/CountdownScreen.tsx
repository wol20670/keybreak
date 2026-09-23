"use client";

import { COUNTDOWN_NOTES, COUNTDOWN_STEPS } from "@/lib/game";

interface CountdownScreenProps {
  index: number;
}

export default function CountdownScreen({ index }: CountdownScreenProps) {
  const step = COUNTDOWN_STEPS[index] ?? COUNTDOWN_STEPS[0];
  const isGo = step === "BREAK!";
  const note = COUNTDOWN_NOTES[index] ?? "";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <p className="h-4 font-pixel text-[10px] tracking-[0.3em] text-primary/70">
        {note && (
          <>
            <span className="text-muted">&gt;</span> {note}
          </>
        )}
      </p>
      <span
        // Re-keying restarts the pop animation on every step.
        key={index}
        className={`kb-countdown kb-display font-pixel ${
          isGo
            ? "text-primary text-5xl sm:text-8xl"
            : "text-bone text-7xl sm:text-9xl"
        }`}
        style={{
          textShadow: isGo
            ? "0 4px 0 var(--color-shadow-hard), 0 0 36px rgb(var(--rgb-primary) / 0.8)"
            : "0 4px 0 var(--color-shadow-hard), 0 0 28px rgb(var(--rgb-primary) / 0.3)",
        }}
      >
        {step}
      </span>
      <p className="font-pixel text-[10px] tracking-[0.5em] text-muted">
        A S D F
      </p>
      <p className="text-sm text-muted">디버그 세션을 시작합니다.</p>
    </div>
  );
}
