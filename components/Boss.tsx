"use client";

import Image from "next/image";
import { memo, useState } from "react";
import type { BossState } from "@/lib/types";

/**
 * Swapping in new art is a one-file change: replace this PNG/WebP. The source
 * is large, so next/image serves a resized, modern-format version. If the file
 * is ever missing or broken, onError falls back to the inline pixel art.
 */
const BOSS_SPRITE_SRC = "/assets/boss/boss-idle.png";
const BOSS_SPRITE_READY = true;

/** 16x14 pixel-art demon, used only when the sprite cannot load. */
const BOSS_PIXELS = [
  "..K..........K..",
  ".KHK........KHK.",
  ".KHK........KHK.",
  "..KKKKKKKKKKKK..",
  ".KHHHHHHHHHHHHK.",
  "KHHHHHHHHHHHHHHK",
  "KHHEEHHHHHHEEHHK",
  "KHHEEHHHHHHEEHHK",
  "KHHHHHHHHHHHHHHK",
  "KHHHHHHHHHHHHHHK",
  ".KHHTTTTTTTTHHK.",
  ".KHHTKTKTKTKHHK.",
  "..KHHHHHHHHHHK..",
  "...KKKKKKKKKK...",
];

const PIXEL_COLORS: Record<string, string> = {
  K: "#26101a",
  H: "#7a2130",
  E: "#f4b942",
  T: "#f5f1e8",
};

const SPRITE_SIZE = "w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80";
const GLOW = "drop-shadow-[0_0_34px_rgba(232,79,95,0.55)]";

const STATE_CLASS: Record<BossState, string> = {
  idle: "kb-boss-idle",
  hit: "kb-boss-hit",
  defeated: "kb-boss-defeated",
};

/**
 * Rendered once and reused. The boss is hit many times per second, so its
 * pixel rects must never be rebuilt on a hit.
 */
const PixelBoss = memo(function PixelBoss() {
  return (
    <svg
      viewBox="0 0 16 14"
      shapeRendering="crispEdges"
      className={`w-48 h-42 sm:w-64 sm:h-56 md:w-80 md:h-70 ${GLOW}`}
      role="img"
      aria-label="보스"
    >
      {BOSS_PIXELS.map((row, y) =>
        row.split("").map((char, x) => {
          const fill = PIXEL_COLORS[char];
          if (!fill) return null;
          return (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
          );
        }),
      )}
    </svg>
  );
});

interface BossProps {
  state: BossState;
  /** Each defeated boss is tinted differently so waves feel distinct. */
  variant: number;
}

function Boss({ state, variant }: BossProps) {
  const [spriteFailed, setSpriteFailed] = useState(!BOSS_SPRITE_READY);
  const hueShift = (variant % 6) * 40;

  return (
    <div
      // Flipping between hit/idle is what restarts the shake; the brightness
      // filter carries the feedback during sustained tapping.
      className={`relative ${STATE_CLASS[state]}`}
      style={{
        filter:
          state === "hit"
            ? `hue-rotate(${hueShift}deg) brightness(2.2) saturate(1.3)`
            : `hue-rotate(${hueShift}deg)`,
        willChange: "transform, filter",
      }}
    >
      {spriteFailed ? (
        <PixelBoss />
      ) : (
        <Image
          src={BOSS_SPRITE_SRC}
          alt="보스"
          width={640}
          height={640}
          priority
          sizes="(min-width: 768px) 320px, (min-width: 640px) 256px, 192px"
          onError={() => setSpriteFailed(true)}
          className={`${SPRITE_SIZE} object-contain ${GLOW}`}
        />
      )}
    </div>
  );
}

export default memo(Boss);
