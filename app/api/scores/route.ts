import { NextResponse } from "next/server";
import { getSql, isMissingTableError } from "@/lib/db";
import { MAX_NICKNAME_LENGTH, MAX_TOTAL_HITS, finalDpm } from "@/lib/game";
import type { RankingEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANKING_LIMIT = 20;

const DB_NOT_CONFIGURED = {
  error: "DB_NOT_CONFIGURED",
  message: "랭킹 서버가 아직 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.",
};

const SCHEMA_MISSING = {
  error: "SCHEMA_MISSING",
  message: "랭킹 테이블이 아직 생성되지 않았습니다. db/schema.sql을 실행해 주세요.",
};

interface ScoreRecord {
  id: string;
  nickname: string;
  dpm: number;
  total_hits: number;
  max_combo: number;
  created_at: string | Date;
}

function toEntry(row: ScoreRecord, index: number): RankingEntry {
  return {
    rank: index + 1,
    id: row.id,
    nickname: row.nickname,
    dpm: row.dpm,
    totalHits: row.total_hits,
    maxCombo: row.max_combo,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** GET /api/scores — top 20, highest DPM first, earliest run wins ties. */
export async function GET() {
  const sql = getSql();
  if (!sql) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  try {
    const rows = (await sql`
      SELECT id, nickname, dpm, total_hits, max_combo, created_at
      FROM scores
      ORDER BY dpm DESC, created_at ASC
      LIMIT ${RANKING_LIMIT}
    `) as ScoreRecord[];

    return NextResponse.json({ entries: rows.map(toEntry) });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(SCHEMA_MISSING, { status: 503 });
    }
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

  const sql = getSql();
  if (!sql) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  try {
    // Tagged template => parameter binding. Never build SQL by concatenation.
    const rows = (await sql`
      INSERT INTO scores (nickname, dpm, total_hits, max_combo)
      VALUES (${trimmed}, ${dpm}, ${totalHits}, ${maxCombo})
      RETURNING id, nickname, dpm, total_hits, max_combo, created_at
    `) as ScoreRecord[];

    return NextResponse.json({ score: toEntry(rows[0], 0) }, { status: 201 });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(SCHEMA_MISSING, { status: 503 });
    }
    console.error("POST /api/scores failed:", error);
    return NextResponse.json(
      { error: "INSERT_FAILED", message: "기록 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
