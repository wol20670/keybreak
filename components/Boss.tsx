"use client";

import Image from "next/image";
import { memo, useCallback, useState } from "react";
import type { BossStage } from "@/lib/game";
import type { BossState } from "@/lib/types";

/**
 * One sprite per visual stage, in evolution order. Replacing the art is a
 * file swap — nothing else needs to change.
 */
const STAGE_SPRITES = [
  "/assets/boss/boss-1.png",
  "/assets/boss/boss-2.png",
  "/assets/boss/boss-3.png",
  "/assets/boss/boss-4.png",
] as const;

/**
 * Per-stage scale, so each form reads as bigger than the last.
 *
 * The source PNGs are all 1254x1254 but their subjects fill very different
 * amounts of that canvas — measured content boxes are 1138x766, 1142x1147,
 * 1243x1249 and 1199x1248. Taking sqrt(w*h) as apparent size, they already
 * render at roughly 75% / 92% / 100% / 98% of one another inside an
 * object-contain box, so these factors are the correction that lands them on
 * the intended 72% / 86% / 100% / 108% progression rather than raw scales.
 */
const STAGE_SCALE = [0.96, 0.94, 1.0, 1.1] as const;

/** 16x14 pixel-art demon, used only when a sprite cannot load. */
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

const SPRITE_BOX = "w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80";

/**
 * Aura per escalation level. Applied on the wrapper's filter chain rather than
 * as a class, because the wrapper already sets `filter` inline and the two
 * would otherwise overwrite each other.
 */
const GLOW_FILTER = [
  "drop-shadow(0 0 28px rgba(232, 79, 95, 0.5))",
  "drop-shadow(0 0 42px rgba(232, 79, 95, 0.7))",
  "drop-shadow(0 0 58px rgba(232, 79, 95, 0.9))",
  "drop-shadow(0 0 74px rgba(244, 185, 66, 0.95))",
] as const;

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
      className="h-full w-full"
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
  /** Which form is on screen. Held back by the engine while a boss is dying. */
  stage: BossStage;
  /** 0-3 aura escalation from stage, combo tier and the final rush. */
  aura?: 0 | 1 | 2 | 3;
  /** Brief flash as a new form appears. */
  phaseTransition?: boolean;
}

function Boss({ state, stage, aura = 0, phaseTransition = false }: BossProps) {
  // Sprites that failed to load fall back to the pixel art for that stage.
  const [failed, setFailed] = useState<readonly boolean[]>([
    false,
    false,
    false,
    false,
  ]);

  const markFailed = useCallback((index: number) => {
    setFailed((prev) => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = true;
      return next;
    });
  }, []);

  const filter = [
    GLOW_FILTER[aura],
    state === "hit" ? "brightness(2.2) saturate(1.3)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      // Flipping between hit/idle is what restarts the shake; the brightness
      // filter carries the feedback during sustained tapping.
      className={`relative ${STATE_CLASS[state]}`}
      style={{ filter, willChange: "transform, filter" }}
    >
      {/*
        The stage scale lives on this inner box, not the wrapper: the wrapper's
        hit and defeat keyframes animate `transform` and would overwrite it.
      */}
      <div
        className={`relative ${SPRITE_BOX} transition-transform duration-500 ease-out ${
          phaseTransition ? "kb-phase-flash" : ""
        }`}
        style={{ transform: `scale(${STAGE_SCALE[stage]})` }}
      >
        {failed[stage] ? (
          <PixelBoss />
        ) : (
          // All four are mounted so evolving never waits on a download; only
          // the current stage is visible.
          STAGE_SPRITES.map((src, index) => (
            <Image
              key={src}
              src={src}
              alt={index === stage ? "보스" : ""}
              aria-hidden={index !== stage}
              width={640}
              height={640}
              priority={index === 0}
              sizes="(min-width: 768px) 320px, (min-width: 640px) 256px, 192px"
              onError={() => markFailed(index)}
              className={`absolute inset-0 h-full w-full object-contain ${
                index === stage ? "opacity-100" : "opacity-0"
              }`}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default memo(Boss);
