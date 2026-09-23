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

export const ATTACK_KEYS = ["a", "s", "d", "f"] as const;
export type AttackKey = (typeof ATTACK_KEYS)[number];

export const BOSS_BASE_HP = 100;
export const BOSS_HP_GROWTH = 1.2;

export const MAX_NICKNAME_LENGTH = 20;

/**
 * Upper bound for a believable run: 30 taps/second for 30s. Anything above
 * this is rejected by the API. This is a sanity check, not anti-cheat —
 * client-authoritative scoring is out of scope for this MVP.
 */
export const MAX_TOTAL_HITS = 900;

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

/** Shout shown the first time a streak reaches each tier. Index 0 is unused. */
export const TIER_LABELS = ["", "RAMPAGE!", "FRENZY!", "KEYBREAKER!!"] as const;

/** How long a tier / final-rush banner stays on screen. */
export const BANNER_MS = 750;

/** Last stretch of the run, used only for visuals — never for scoring. */
export const FINAL_RUSH_MS = 5_000;

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
