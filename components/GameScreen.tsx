"use client";

import Boss from "./Boss";
import HudStat from "./HudStat";
import KeyPad from "./KeyPad";
import { comboTier } from "@/lib/game";
import type { GameSnapshot } from "@/hooks/useKeybreakGame";

const COMBO_TONE = [
  "text-muted",
  "text-bone",
  "text-accent",
  "text-primary",
] as const;

interface GameScreenProps {
  snapshot: GameSnapshot;
}

export default function GameScreen({ snapshot }: GameScreenProps) {
  const seconds = Math.max(0, snapshot.timeLeftMs / 1000);
  const urgent = seconds <= 5;
  const hpPercent =
    snapshot.bossMaxHp > 0 ? (snapshot.bossHp / snapshot.bossMaxHp) * 100 : 0;
  const tier = comboTier(snapshot.combo);

  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-4 px-4 py-4 sm:py-6">
      {/* Boss HP + timer */}
      <div className="w-full max-w-3xl">
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-pixel text-[10px] tracking-widest text-primary">
                BOSS {snapshot.bossesDefeated + 1}
              </span>
              <span className="font-pixel text-[10px] tabular-nums text-muted">
                {Math.max(0, Math.ceil(snapshot.bossHp))}/{snapshot.bossMaxHp}
              </span>
            </div>
            <div className="h-5 w-full overflow-hidden rounded-sm border-2 border-surface-2 bg-ink-deep">
              <div
                className="h-full bg-gradient-to-r from-primary-dim via-primary to-accent"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-pixel text-[9px] tracking-widest text-muted">
              TIME
            </div>
            <div
              className={`font-pixel tabular-nums text-3xl sm:text-5xl ${
                urgent ? "text-primary kb-blink" : "text-bone"
              }`}
            >
              {seconds.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Boss stage */}
      <div className="relative flex flex-1 items-center justify-center">
        <Boss state={snapshot.bossState} variant={snapshot.bossesDefeated} />

        {/* Floating damage numbers, anchored to the boss centre. */}
        <div className="pointer-events-none absolute inset-0">
          {snapshot.damageNumbers.map((d) => (
            <span
              key={d.id}
              className={`kb-damage absolute font-pixel tabular-nums ${
                d.crit ? "text-accent text-2xl" : "text-bone text-lg"
              }`}
              style={{
                left: `calc(50% + ${d.x}px)`,
                top: `calc(50% + ${d.y}px)`,
                textShadow: "0 2px 0 #26101a",
              }}
            >
              {d.value}
            </span>
          ))}
        </div>

        {snapshot.combo >= 30 && (
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2">
            <span
              className={`font-pixel text-xl sm:text-3xl tabular-nums ${COMBO_TONE[tier]}`}
              style={{ textShadow: "0 3px 0 #26101a" }}
            >
              {snapshot.combo} COMBO
            </span>
          </div>
        )}
      </div>

      {/* Stats + key visualiser */}
      <div className="flex w-full max-w-3xl flex-col items-center gap-4">
        <div className="kb-panel flex w-full items-center justify-around rounded-md bg-surface/80 py-3">
          <HudStat label="DPM" value={snapshot.dpm} tone="accent" size="lg" />
          <HudStat label="HITS" value={snapshot.totalHits} />
          <HudStat label="COMBO" value={snapshot.combo} tone="primary" />
          <HudStat label="MAX" value={snapshot.maxCombo} />
        </div>
        <KeyPad activeKeys={snapshot.activeKeys} />
      </div>
    </div>
  );
}
