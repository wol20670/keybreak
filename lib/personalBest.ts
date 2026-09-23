/**
 * Personal best DPM, kept in localStorage.
 *
 * Purely local bragging rights — it never reaches the API and has nothing to
 * do with the stored ranking. Every access is wrapped, so a browser that
 * blocks storage (private mode, disabled site data) just behaves as if there
 * were no previous record.
 */

const STORAGE_KEY = "keybreak:bestDpm";

/** Previous best, or 0 when there is none or storage is unavailable. */
export function readBestDpm(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

/** Stores the run only when it beats the stored best. Failures are ignored. */
export function writeBestDpm(dpm: number): void {
  if (!Number.isFinite(dpm) || dpm <= 0) return;
  try {
    if (dpm > readBestDpm()) {
      localStorage.setItem(STORAGE_KEY, String(Math.floor(dpm)));
    }
  } catch {
    // Storage unavailable — the record just will not persist.
  }
}
