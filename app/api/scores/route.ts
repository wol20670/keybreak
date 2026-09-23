import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";
import {
  SCORES_COLLECTION,
  extractIndexUrl,
  getDb,
  isAuthError,
  isMissingIndexError,
  isNotFoundError,
} from "@/lib/firebase";
import { MAX_NICKNAME_LENGTH, MAX_TOTAL_HITS, finalDpm } from "@/lib/game";
import type { RankingEntry } from "@/lib/types";

export const dynamic = "force-dynamic";
// firebase-admin is a Node SDK and cannot run on the edge runtime.
export const runtime = "nodejs";
// Firestore for this project lives in asia-northeast3, so keep the function
// next to it instead of the default us-east.
export const preferredRegion = "icn1";

const RANKING_LIMIT = 20;

/**
 * How many rows the fallback path pulls before sorting in memory. Only used
 * while the composite index is missing or still building.
 */
const FALLBACK_FETCH = 100;

const DB_NOT_CONFIGURED = {
  error: "DB_NOT_CONFIGURED",
  message: "랭킹 서버가 아직 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.",
};

const DB_UNAVAILABLE = {
  error: "DB_UNAVAILABLE",
  message: "랭킹 데이터베이스에 접근할 수 없습니다. 잠시 후 다시 시도해 주세요.",
};

/** Log the index hint once per process instead of on every request. */
let warnedAboutIndex = false;
function warnMissingIndex(error: unknown) {
  if (warnedAboutIndex) return;
  warnedAboutIndex = true;
  const url = extractIndexUrl(error);
  console.warn(
    "Composite index (dpm DESC, createdAt ASC) is missing or still building; " +
      "serving the ranking from the in-memory fallback." +
      (url ? ` Create it here: ${url}` : " Run `npm run db:index`."),
  );
}

/**
 * Firestore Timestamps must never reach the JSON response — the client expects
 * an ISO string. serverTimestamp() also reads back as null for an instant
 * before it resolves, so that case is handled too.
 */
function toIso(value: unknown): string {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date(0).toISOString();
}

function toEntry(doc: DocumentSnapshot<DocumentData>, index: number): RankingEntry {
  const data = doc.data() ?? {};
  return {
    rank: index + 1,
    id: doc.id,
    nickname: String(data.nickname ?? ""),
    dpm: Number(data.dpm ?? 0),
    totalHits: Number(data.totalHits ?? 0),
    maxCombo: Number(data.maxCombo ?? 0),
    createdAt: toIso(data.createdAt),
  };
}

/** Highest DPM first; on a tie the earlier run ranks higher. */
function byRank(a: RankingEntry, b: RankingEntry): number {
  return b.dpm - a.dpm || a.createdAt.localeCompare(b.createdAt);
}

function unavailable(error: unknown): NextResponse | null {
  if (isAuthError(error) || isNotFoundError(error)) {
    return NextResponse.json(DB_UNAVAILABLE, { status: 503 });
  }
  return null;
}

/** GET /api/scores — top 20, highest DPM first, earliest run wins ties. */
export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  try {
    let entries: RankingEntry[];

    try {
      // Exact ordering. Needs the (dpm DESC, createdAt ASC) composite index.
      const snapshot = await db
        .collection(SCORES_COLLECTION)
        .orderBy("dpm", "desc")
        .orderBy("createdAt", "asc")
        .limit(RANKING_LIMIT)
        .get();
      entries = snapshot.docs.map(toEntry);
    } catch (error) {
      if (!isMissingIndexError(error)) throw error;
      // Fallback: single-field order (always indexed), tie-break in memory, so
      // the ranking keeps working while the composite index is built.
      warnMissingIndex(error);
      const snapshot = await db
        .collection(SCORES_COLLECTION)
        .orderBy("dpm", "desc")
        .limit(FALLBACK_FETCH)
        .get();
      entries = snapshot.docs
        .map(toEntry)
        .sort(byRank)
        .slice(0, RANKING_LIMIT)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }

    return NextResponse.json({ entries });
  } catch (error) {
    const response = unavailable(error);
    if (response) return response;
    console.error("GET /api/scores failed:", error);
    return NextResponse.json(
      { error: "QUERY_FAILED", message: "랭킹을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

function invalid(message: string) {
  return NextResponse.json({ error: "INVALID_PAYLOAD", message }, { status: 400 });
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** POST /api/scores — validate then store one run. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("요청 형식이 올바르지 않습니다.");
  }

  if (typeof body !== "object" || body === null) {
    return invalid("요청 형식이 올바르지 않습니다.");
  }

  const { nickname, dpm, totalHits, maxCombo } = body as Record<string, unknown>;

  if (typeof nickname !== "string") return invalid("닉네임을 입력해 주세요.");
  const trimmed = nickname.trim();
  if (trimmed.length < 1) return invalid("닉네임을 입력해 주세요.");
  if (trimmed.length > MAX_NICKNAME_LENGTH) {
    return invalid(`닉네임은 ${MAX_NICKNAME_LENGTH}자 이하여야 합니다.`);
  }

  if (!isNonNegativeInt(totalHits)) return invalid("타격 수가 올바르지 않습니다.");
  if (totalHits > MAX_TOTAL_HITS) return invalid("기록이 허용 범위를 벗어났습니다.");

  if (!isNonNegativeInt(maxCombo)) return invalid("콤보가 올바르지 않습니다.");
  if (maxCombo > totalHits) return invalid("콤보가 타격 수보다 클 수 없습니다.");

  if (!isNonNegativeInt(dpm) || dpm !== finalDpm(totalHits)) {
    return invalid("DPM이 타격 수와 일치하지 않습니다.");
  }

  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  try {
    const ref = await db.collection(SCORES_COLLECTION).add({
      nickname: trimmed,
      dpm,
      totalHits,
      maxCombo,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Read back so the response carries the resolved server timestamp rather
    // than an unresolved sentinel.
    const snapshot = await ref.get();
    return NextResponse.json({ score: toEntry(snapshot, 0) }, { status: 201 });
  } catch (error) {
    const response = unavailable(error);
    if (response) return response;
    console.error("POST /api/scores failed:", error);
    return NextResponse.json(
      { error: "INSERT_FAILED", message: "기록 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
