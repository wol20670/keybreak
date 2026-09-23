"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  initAudio,
  playCountdown,
  playDefeat,
  playGameOver,
  playHit,
} from "@/lib/audio";
import {
  ATTACK_KEYS,
  BOSS_DEFEAT_MS,
  BOSS_HIT_MS,
  COMBO_TIMEOUT_MS,
  COUNTDOWN_STEPS,
  COUNTDOWN_STEP_MS,
  DAMAGE_NUMBER_MS,
  GAME_DURATION_MS,
  KEY_FLASH_MS,
  MAX_DAMAGE_NUMBERS,
  bossMaxHp,
  finalDpm,
  hitDamage,
  isAttackKey,
  liveDpm,
  type AttackKey,
} from "@/lib/game";
import type { BossState, GamePhase, GameResult } from "@/lib/types";

export interface DamageNumber {
  id: number;
  value: number;
  /** Percent offsets from the boss centre, fixed at spawn time. */
  x: number;
  y: number;
  bornAt: number;
  crit: boolean;
}

/**
 * Everything the UI draws. Produced once per animation frame from refs, so a
 * key press never has to wait on a React render.
 */
export interface GameSnapshot {
  timeLeftMs: number;
  totalHits: number;
  dpm: number;
  combo: number;
  maxCombo: number;
  bossHp: number;
  bossMaxHp: number;
  bossesDefeated: number;
  bossState: BossState;
  activeKeys: AttackKey[];
  damageNumbers: DamageNumber[];
}

const EMPTY_SNAPSHOT: GameSnapshot = {
  timeLeftMs: GAME_DURATION_MS,
  totalHits: 0,
  dpm: 0,
  combo: 0,
  maxCombo: 0,
  bossHp: bossMaxHp(0),
  bossMaxHp: bossMaxHp(0),
  bossesDefeated: 0,
  bossState: "idle",
  activeKeys: [],
  damageNumbers: [],
};

/** True when the event target is somewhere the user is typing text. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useKeybreakGame() {
  const [phase, setPhase] = useState<GamePhase>("START");
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(EMPTY_SNAPSHOT);
  const [result, setResult] = useState<GameResult | null>(null);

  // --- Authoritative state. Mutated by key events, read by the rAF loop. ---
  const phaseRef = useRef<GamePhase>("START");
  const hitsRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const lastHitAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const bossHpRef = useRef(bossMaxHp(0));
  const bossMaxHpRef = useRef(bossMaxHp(0));
  const bossesDefeatedRef = useRef(0);
  const bossHitUntilRef = useRef(0);
  const bossDefeatUntilRef = useRef(0);
  const heldKeysRef = useRef<Set<AttackKey>>(new Set());
  const keyFlashRef = useRef<Map<AttackKey, number>>(new Map());
  const damageNumbersRef = useRef<DamageNumber[]>([]);
  const damageIdRef = useRef(0);

  // --- Timer plumbing. ---
  const rafRef = useRef<number | null>(null);
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const endedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (endTimeoutRef.current !== null) {
      clearTimeout(endTimeoutRef.current);
      endTimeoutRef.current = null;
    }
    for (const id of countdownTimeoutsRef.current) clearTimeout(id);
    countdownTimeoutsRef.current = [];
  }, []);

  /** Wipe every trace of the previous run. */
  const resetRefs = useCallback(() => {
    hitsRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    lastHitAtRef.current = 0;
    startedAtRef.current = 0;
    bossesDefeatedRef.current = 0;
    bossHpRef.current = bossMaxHp(0);
    bossMaxHpRef.current = bossMaxHp(0);
    bossHitUntilRef.current = 0;
    bossDefeatUntilRef.current = 0;
    heldKeysRef.current.clear();
    keyFlashRef.current.clear();
    damageNumbersRef.current = [];
    endedRef.current = false;
  }, []);

  /**
   * Ends the run exactly once and freezes the final stats straight from the
   * refs — never from the throttled render snapshot.
   */
  const endGame = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearTimers();
    phaseRef.current = "RESULT";
    playGameOver();

    const totalHits = hitsRef.current;
    setResult({
      totalHits,
      maxCombo: maxComboRef.current,
      dpm: finalDpm(totalHits),
      bossesDefeated: bossesDefeatedRef.current,
    });
    setSnapshot((prev) => ({
      ...prev,
      timeLeftMs: 0,
      totalHits,
      dpm: finalDpm(totalHits),
      combo: 0,
      maxCombo: maxComboRef.current,
      activeKeys: [],
      damageNumbers: [],
    }));
    setPhase("RESULT");
  }, [clearTimers]);

  /**
   * The hot path. Touches refs only — zero React work, so bursts of taps are
   * never dropped waiting on a render.
   */
  const registerHit = useCallback((key: AttackKey) => {
    const now = performance.now();

    hitsRef.current += 1;
    comboRef.current += 1;
    if (comboRef.current > maxComboRef.current) {
      maxComboRef.current = comboRef.current;
    }
    lastHitAtRef.current = now;

    const damage = hitDamage(comboRef.current);
    bossHpRef.current -= damage;
    bossHitUntilRef.current = now + BOSS_HIT_MS;

    playHit(comboRef.current);

    if (bossHpRef.current <= 0) {
      bossesDefeatedRef.current += 1;
      bossDefeatUntilRef.current = now + BOSS_DEFEAT_MS;
      const nextMax = bossMaxHp(bossesDefeatedRef.current);
      bossMaxHpRef.current = nextMax;
      bossHpRef.current = nextMax;
      playDefeat();
    }

    keyFlashRef.current.set(key, now + KEY_FLASH_MS);

    damageIdRef.current += 1;
    damageNumbersRef.current.push({
      id: damageIdRef.current,
      value: damage,
      // Spread wide and spawn above centre so numbers do not pile up on the
      // boss's face during fast tapping.
      x: (Math.random() - 0.5) * 220,
      y: -50 + Math.random() * 70,
      bornAt: now,
      crit: damage >= 3,
    });
    if (damageNumbersRef.current.length > MAX_DAMAGE_NUMBERS) {
      damageNumbersRef.current.splice(
        0,
        damageNumbersRef.current.length - MAX_DAMAGE_NUMBERS,
      );
    }
  }, []);

  // Key listeners are attached once and gated on phaseRef, so there is no
  // add/remove churn between phases.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return; // holding a key must not farm score
      if (event.ctrlKey || event.metaKey || event.altKey) return; // keep Ctrl+F etc.

      const key = event.key.toLowerCase();
      if (!isAttackKey(key)) return;
      if (isTextEntry(event.target)) return; // typing a nickname is not an attack

      // Only now is it certain this keystroke belongs to the game.
      event.preventDefault();
      if (phaseRef.current !== "PLAYING") return;

      heldKeysRef.current.add(key);
      registerHit(key);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (isAttackKey(key)) heldKeysRef.current.delete(key);
    };

    const onBlur = () => heldKeysRef.current.clear();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [registerHit]);

  /** Starts the 30s run. Drives all rendering from a single rAF loop. */
  const beginPlay = useCallback(() => {
    clearTimers();
    startedAtRef.current = performance.now();
    phaseRef.current = "PLAYING";
    setPhase("PLAYING");

    const tick = () => {
      const now = performance.now();
      const elapsed = now - startedAtRef.current;
      const timeLeftMs = GAME_DURATION_MS - elapsed;

      if (timeLeftMs <= 0) {
        endGame();
        return;
      }

      if (comboRef.current > 0 && now - lastHitAtRef.current > COMBO_TIMEOUT_MS) {
        comboRef.current = 0;
      }

      const activeKeys = ATTACK_KEYS.filter((key) => {
        if (heldKeysRef.current.has(key)) return true;
        const until = keyFlashRef.current.get(key);
        return until !== undefined && now < until;
      });

      damageNumbersRef.current = damageNumbersRef.current.filter(
        (d) => now - d.bornAt < DAMAGE_NUMBER_MS,
      );

      const bossState: BossState =
        now < bossDefeatUntilRef.current
          ? "defeated"
          : now < bossHitUntilRef.current
            ? "hit"
            : "idle";

      setSnapshot({
        timeLeftMs,
        totalHits: hitsRef.current,
        dpm: liveDpm(hitsRef.current, elapsed),
        combo: comboRef.current,
        maxCombo: maxComboRef.current,
        bossHp: Math.max(0, bossHpRef.current),
        bossMaxHp: bossMaxHpRef.current,
        bossesDefeated: bossesDefeatedRef.current,
        bossState,
        activeKeys,
        damageNumbers: damageNumbersRef.current.slice(),
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    // Backup: rAF is paused while the tab is hidden, so a timer guarantees the
    // run still ends on schedule. endGame() is idempotent.
    endTimeoutRef.current = setTimeout(endGame, GAME_DURATION_MS);
  }, [clearTimers, endGame]);

  /** START -> COUNTDOWN. Input during the countdown never scores. */
  const startGame = useCallback(() => {
    clearTimers();
    resetRefs();
    setResult(null);
    setSnapshot(EMPTY_SNAPSHOT);
    setCountdownIndex(0);
    phaseRef.current = "COUNTDOWN";
    setPhase("COUNTDOWN");

    // START / RETRY are clicks, so this is the user gesture audio needs.
    initAudio();
    playCountdown(false);

    const lastStep = COUNTDOWN_STEPS.length - 1;
    let delay = 0;
    COUNTDOWN_STEPS.forEach((_, index) => {
      if (index > 0) {
        delay += COUNTDOWN_STEP_MS[index - 1];
        countdownTimeoutsRef.current.push(
          setTimeout(() => {
            setCountdownIndex(index);
            playCountdown(index === lastStep);
          }, delay),
        );
      }
    });
    countdownTimeoutsRef.current.push(
      setTimeout(beginPlay, delay + COUNTDOWN_STEP_MS[COUNTDOWN_STEPS.length - 1]),
    );
  }, [beginPlay, clearTimers, resetRefs]);

  /** RESULT -> START, with every previous stat cleared. */
  const backToStart = useCallback(() => {
    clearTimers();
    resetRefs();
    setResult(null);
    setSnapshot(EMPTY_SNAPSHOT);
    phaseRef.current = "START";
    setPhase("START");
  }, [clearTimers, resetRefs]);

  // A tab that comes back after the clock ran out should end immediately.
  useEffect(() => {
    const onVisibility = () => {
      if (phaseRef.current !== "PLAYING") return;
      if (performance.now() - startedAtRef.current >= GAME_DURATION_MS) endGame();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [endGame]);

  useEffect(() => clearTimers, [clearTimers]);

  return {
    phase,
    countdownIndex,
    snapshot,
    result,
    startGame,
    retry: startGame,
    backToStart,
  };
}
