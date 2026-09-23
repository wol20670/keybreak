"use client";

import { COUNTDOWN_STEPS } from "@/lib/game";

interface CountdownScreenProps {
  index: number;
}

export default function CountdownScreen({ index }: CountdownScreenProps) {
  const step = COUNTDOWN_STEPS[index] ?? COUNTDOWN_STEPS[0];
  const isGo = step === "BREAK!";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <span
        // Re-keying restarts the pop animation on every step.
        key={index}
        className={`kb-countdown font-pixel ${
          isGo
            ? "text-primary text-5xl sm:text-8xl"
            : "text-bone text-7xl sm:text-9xl"
        }`}
        style={{ textShadow: "0 6px 0 #26101a" }}
      >
        {step}
      </span>
      <p className="font-pixel text-[10px] tracking-widest text-muted">
        A S D F
      </p>
      <p className="text-sm text-muted">준비하세요. 곧 시작합니다.</p>
    </div>
  );
}
