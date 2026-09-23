import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Lazily-created Firestore handle (Admin SDK, server only).
 *
 * Deliberately returns null instead of throwing when the service account env
 * vars are missing, so the app still builds and the game still plays without a
 * database. Add the env vars and the ranking starts working with no code change.
 *
 * Never import this from a client component: the service account key must stay
 * on the server.
 */

export const SCORES_COLLECTION = "scores";

let cached: Firestore | null = null;

/**
 * A PEM key survives .env round-trips in two shapes: with real newlines, or
 * with literal backslash-n. Vercel stores the former, dotenv files usually
 * carry the latter. Accept both, and tolerate wrapping quotes.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

export function getDb(): Firestore | null {
  if (cached) return cached;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) return null;

  try {
    // getApps() guards against re-initialising across dev HMR reloads and
    // warm serverless invocations.
    const app = getApps().length
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: normalizePrivateKey(privateKeyRaw),
          }),
        });

    cached = getFirestore(app);
    return cached;
  } catch (error) {
    console.error("Firebase Admin initialisation failed:", error);
    return null;
  }
}

function errorCode(error: unknown): number | string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  return (error as { code?: number | string }).code;
}

/**
 * gRPC FAILED_PRECONDITION. For an ordered multi-field query this means the
 * composite index does not exist (or is still building).
 */
export function isMissingIndexError(error: unknown): boolean {
  return errorCode(error) === 9;
}

/** PERMISSION_DENIED (7) or UNAUTHENTICATED (16). */
export function isAuthError(error: unknown): boolean {
  const code = errorCode(error);
  return code === 7 || code === 16;
}

/** NOT_FOUND (5) — usually no Firestore database in the project yet. */
export function isNotFoundError(error: unknown): boolean {
  return errorCode(error) === 5;
}

/**
 * Firestore puts a ready-to-click index creation URL in the error message.
 * Surfacing it turns a failure into an actionable instruction.
 */
export function extractIndexUrl(error: unknown): string | null {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  const match = message.match(/https:\/\/console\.firebase\.google\.com\/\S+/);
  return match ? match[0].replace(/[).,]+$/, "") : null;
}
