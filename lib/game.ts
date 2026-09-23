/**
 * Pure game rules and constants. Shared by the client engine and the API
 * validator, so both sides agree on what a legal score looks like.
 */

export const GAME_DURATION_MS = 30_000;
export const GAME_DURATION_SEC = GAME_DURATION_MS / 1000;

/** No input after this long resets the combo. */
export const COMBO_TIMEOUT_MS = 1_500;

/** How long a key stays lit after a tap, so very fast taps stay visible. */
export const KEY_FLASH_MS = 70;

/** Boss hit-flash and defeat-burst durations. */
export const BOSS_HIT_MS = 90;
export const BOSS_DEFEAT_MS = 450;

export const DAMAGE_NUMBER_MS = 650;
export const MAX_DAMAGE_NUMBERS = 24;

export const COUNTDOWN_STEPS = ["3", "2", "1", "BREAK!"] as const;
export const COUNTDOWN_STEP_MS = [800, 800, 800, 400] as const;

/** Display-only caption under each countdown step. Parallel to the steps. */
export const COUNTDOWN_NOTES = [
  "DEBUGGER ATTACHED",
  "LOADING SYMBOLS",
  "SYSTEM READY",
  "",
] as const;

export const ATTACK_KEYS = ["a", "s", "d", "f"] as const;
export type AttackKey = (typeof ATTACK_KEYS)[number];

/** How many valid hits each attack key took. Display only. */
export type HitsByKey = Record<AttackKey, number>;

export const BOSS_BASE_HP = 100;
export const BOSS_HP_GROWTH = 1.2;

export const MAX_NICKNAME_LENGTH = 20;

/**
 * Upper bound for a believable run: 60 taps/second for 30s. Anything above
 * this is rejected by the API. This is a sanity check, not anti-cheat —
 * client-authoritative scoring is out of scope for this MVP, so the bound
 * earns nothing by sitting close to real play. It only has to reject garbage.
 *
 * It was 30/s, which real players cleared: a 1106-hit run (~37/s) was refused
 * at save time, after the full 30 seconds had already been played. Losing a
 * genuine personal best costs far more than admitting an inflated one.
 */
export const MAX_TOTAL_HITS = 1800;

export function isAttackKey(key: string): key is AttackKey {
  return (ATTACK_KEYS as readonly string[]).includes(key);
}

/** Each defeated boss comes back 20% tougher. */
export function bossMaxHp(defeatedCount: number): number {
  return Math.round(BOSS_BASE_HP * Math.pow(BOSS_HP_GROWTH, defeatedCount));
}

/** Higher combos hit harder, capped so the pace stays readable. */
export function hitDamage(combo: number): number {
  return 1 + Math.min(4, Math.floor(combo / 30));
}

/** Confirmed score for a full 30s run: hits / 30s * 60 === hits * 2. */
export function finalDpm(totalHits: number): number {
  return totalHits * 2;
}

/**
 * Extrapolating over a few hundred milliseconds produces absurd numbers
 * (3 taps in 100ms reads as 1800 DPM), so the first second is treated as a
 * full second. Guards the divide-by-zero case at the same time.
 */
const LIVE_DPM_MIN_WINDOW_MS = 1_000;

/** In-run DPM, extrapolated from actual elapsed time. */
export function liveDpm(totalHits: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const window = Math.max(elapsedMs, LIVE_DPM_MIN_WINDOW_MS);
  return Math.round((totalHits / (window / 1000)) * 60);
}

/** Cosmetic combo tiers, used to escalate the visuals. */
export function comboTier(combo: number): 0 | 1 | 2 | 3 {
  if (combo >= 90) return 3;
  if (combo >= 60) return 2;
  if (combo >= 30) return 1;
  return 0;
}

export type ComboTier = ReturnType<typeof comboTier>;

/**
 * Visual boss stage. Purely cosmetic: the boss HP curve, the damage formula
 * and everything that gets stored are unchanged — only the sprite and the
 * surrounding presentation differ.
 */
export type BossStage = 0 | 1 | 2 | 3;

export const KILLS_PER_STAGE = 3;

/** 0-2 kills → 01, 3-5 → 02, 6-8 → 03, 9+ → FINAL. */
export function bossVisualStage(bossesDefeated: number): BossStage {
  return Math.min(3, Math.floor(bossesDefeated / KILLS_PER_STAGE)) as BossStage;
}

export const STAGE_LABELS = [
  "STAGE 01",
  "STAGE 02",
  "STAGE 03",
  "FINAL",
] as const;

/**
 * Display-only names. Never stored, never sent to the API.
 * A stray error grows into a node, then into the thing running the system.
 */
export const STAGE_NAMES = [
  "GLITCH SEED",
  "FAULT NODE",
  "PROCESS KEEPER",
  "SYSTEM OVERLORD",
] as const;

/** Shout on entering each stage. Index 0 is unused — stage 01 is the start. */
export const PHASE_LABELS = ["", "PHASE 02", "PHASE 03", "KERNEL PANIC"] as const;

/** How long the evolution flash runs once the new sprite appears. */
export const PHASE_TRANSITION_MS = 700;

/**
 * Shout shown the first time a streak reaches each tier. Index 0 is unused.
 * These praise the player, so they read as the debugger closing in — never as
 * the crash language reserved for the boss falling apart.
 */
export const TIER_LABELS = ["", "TRACE LOCK!", "HOT PATH!", "OVERCLOCK!!"] as const;

/** How long a tier / final-rush banner stays on screen. */
export const BANNER_MS = 750;

/** Last stretch of the run, used only for visuals — never for scoring. */
export const FINAL_RUSH_MS = 5_000;

/**
 * How evenly the four keys were used, 0-100.
 *
 * Deliberately simple and predictable: take how far each key sits from the
 * even share, and divide by how far it could possibly be. Every tap on a
 * single key gives a spread of exactly 1.5 * total, which is the worst case,
 * so that ratio maps perfectly even to 100 and fully lopsided to 0.
 *
 * 25/25/25/25 -> 100 · 10/20/30/40 -> 73 · 100/0/0/0 -> 0 · nothing -> 0
 */
export function keyBalanceScore(hits: HitsByKey): number {
  const total = hits.a + hits.s + hits.d + hits.f;
  if (total <= 0) return 0;

  const even = total / 4;
  const spread =
    Math.abs(hits.a - even) +
    Math.abs(hits.s - even) +
    Math.abs(hits.d - even) +
    Math.abs(hits.f - even);

  const score = Math.round((1 - spread / (1.5 * total)) * 100);
  return Math.max(0, Math.min(100, score));
}

/**
 * Display-only rank for the result screen. Never stored, never sent to the
 * API — the saved record is still just dpm / hits / combo.
 */
export function scoreGrade(dpm: number): "S" | "A" | "B" | "C" {
  if (dpm >= 1000) return "S";
  if (dpm >= 800) return "A";
  if (dpm >= 600) return "B";
  return "C";
}
