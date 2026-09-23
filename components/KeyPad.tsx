"use client";

import { memo } from "react";
import { ATTACK_KEYS, type AttackKey } from "@/lib/game";

interface KeyPadProps {
  activeKeys: AttackKey[];
  size?: "sm" | "lg";
}

/** The four attack keys, lit while held or briefly after a tap. */
function KeyPad({ activeKeys, size = "lg" }: KeyPadProps) {
  const box =
    size === "lg"
      ? "w-16 h-16 sm:w-20 sm:h-20 text-xl sm:text-2xl"
      : "w-11 h-11 text-sm";

  return (
    <div className="flex gap-2 sm:gap-3">
      {ATTACK_KEYS.map((key: AttackKey) => {
        const active = activeKeys.includes(key);
        return (
          <div
            key={key}
            aria-hidden
            className={[
              box,
              "font-pixel grid place-items-center rounded-md border-2 transition-none select-none",
              active
                ? "bg-primary text-ink border-bone translate-y-[3px] shadow-[0_0_24px_6px_rgba(232,79,95,0.65)]"
                : "bg-surface text-muted border-surface-2 shadow-[0_4px_0_0_rgba(0,0,0,0.5)]",
            ].join(" ")}
          >
            {key.toUpperCase()}
          </div>
        );
      })}
    </div>
  );
}

export default memo(KeyPad);
