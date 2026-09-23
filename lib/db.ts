import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Lazily-created Neon client.
 *
 * Deliberately returns null instead of throwing when DATABASE_URL is missing,
 * so the app still builds and the game still plays without a database. Add the
 * env var and the ranking starts working with no code change.
 *
 * Server-only: never expose this URL through a NEXT_PUBLIC_ variable.
 */
let cached: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) cached = neon(url);
  return cached;
}

/** Postgres "relation does not exist" — i.e. db/schema.sql was never run. */
export function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "42P01"
  );
}
