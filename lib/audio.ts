/**
 * Tiny WebAudio sound bank — synthesised, so there are no audio files to load
 * and nothing to wait for.
 *
 * Every entry point is wrapped so that a missing/blocked AudioContext can
 * never break the game: if audio fails, the game simply runs silent.
 *
 * The context is only created from a user gesture (the START click), which is
 * what browser autoplay policies require.
 */

const STORAGE_KEY = "keybreak:muted";
const MASTER_GAIN = 0.22;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let loaded = false;

const listeners = new Set<() => void>();

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    muted = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    muted = false;
  }
}

/** For useSyncExternalStore, so the UI toggle tracks the real mute state. */
export function subscribeMute(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getMutedSnapshot(): boolean {
  ensureLoaded();
  return muted;
}

/** Call from a user gesture. Safe to call repeatedly. */
export function initAudio(): void {
  try {
    ensureLoaded();

    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_GAIN;
      master.connect(ctx.destination);
    }

    // Browsers start the context suspended until a gesture resumes it.
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
    master = null;
  }
}

export function setMuted(next: boolean): void {
  ensureLoaded();
  muted = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Private mode: the preference just will not persist.
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(next ? 0 : MASTER_GAIN, ctx.currentTime, 0.01);
  }
  for (const listener of listeners) listener();
}

interface ToneOptions {
  frequency: number;
  /** Seconds. */
  duration: number;
  type?: OscillatorType;
  peak?: number;
  /** Slide to this frequency across the tone. */
  slideTo?: number;
}

function tone({
  frequency,
  duration,
  type = "square",
  peak = 1,
  slideTo,
}: ToneOptions): void {
  if (!ctx || !master || muted) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, slideTo),
        now + duration,
      );
    }

    // Fast attack, exponential decay — reads as a percussive blip.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Ignore: audio is never allowed to interrupt gameplay.
  }
}

/** Called on every valid hit — must stay cheap. Pitch climbs with the combo. */
export function playHit(combo: number): void {
  const step = Math.min(12, Math.floor(combo / 10));
  tone({
    frequency: 180 + step * 22 + Math.random() * 18,
    duration: 0.055,
    type: "square",
    peak: 0.5,
  });
}

export function playDefeat(): void {
  tone({ frequency: 320, slideTo: 48, duration: 0.5, type: "sawtooth", peak: 0.8 });
}

export function playCountdown(isFinal: boolean): void {
  if (isFinal) {
    tone({ frequency: 880, duration: 0.28, type: "square", peak: 0.7 });
  } else {
    tone({ frequency: 440, duration: 0.12, type: "triangle", peak: 0.6 });
  }
}

export function playGameOver(): void {
  tone({ frequency: 520, slideTo: 130, duration: 0.7, type: "triangle", peak: 0.7 });
}
