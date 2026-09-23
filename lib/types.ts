import type { HitsByKey } from "./game";

export type GamePhase = "START" | "COUNTDOWN" | "PLAYING" | "RESULT";

export type BossState = "idle" | "hit" | "defeated";

/** Final, confirmed stats for one 30s run. */
export interface GameResult {
  totalHits: number;
  maxCombo: number;
  dpm: number;
  bossesDefeated: number;
  /**
   * Per-key breakdown for the result screen. Display only: it is never stored
   * and never part of the POST /api/scores payload.
   */
  hitsByKey: HitsByKey;
}

/** Body of POST /api/scores. */
export interface ScorePayload {
  nickname: string;
  dpm: number;
  totalHits: number;
  maxCombo: number;
}

export interface ScoreRow {
  id: string;
  nickname: string;
  dpm: number;
  totalHits: number;
  maxCombo: number;
  createdAt: string;
}

export interface RankingEntry extends ScoreRow {
  rank: number;
}

export interface ApiError {
  error: string;
  message: string;
}
