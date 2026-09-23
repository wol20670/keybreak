"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiError, RankingEntry } from "@/lib/types";

type Status = "loading" | "ok" | "error";

/**
 * Presentation only for the top three rows — the query, the ordering and the
 * `rank` values all come from the API untouched.
 */
const PODIUM: Record<
  number,
  { label: string; rank: string; name: string; row: string; dpm: string }
> = {
  1: {
    label: "1ST",
    rank: "text-accent",
    name: "text-accent font-bold",
    row: "kb-gold-row bg-accent/10",
    dpm: "text-accent text-base",
  },
  2: {
    label: "2ND",
    rank: "text-bone",
    name: "text-bone",
    row: "bg-bone/5",
    dpm: "text-sm text-accent",
  },
  3: {
    label: "3RD",
    rank: "text-primary",
    name: "text-bone",
    row: "bg-primary/5",
    dpm: "text-sm text-accent",
  },
};

type LoadResult =
  | { ok: true; entries: RankingEntry[] }
  | { ok: false; message: string };

/** Kept free of React state so the effect only updates state in a callback. */
async function fetchScores(): Promise<LoadResult> {
  try {
    const response = await fetch("/api/scores", { cache: "no-store" });
    const data: unknown = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      return {
        ok: false,
        message: error?.message ?? "랭킹을 불러오지 못했습니다.",
      };
    }

    return {
      ok: true,
      entries: (data as { entries: RankingEntry[] }).entries ?? [],
    };
  } catch {
    return { ok: false, message: "네트워크 오류로 랭킹을 불러오지 못했습니다." };
  }
}

interface RankingPanelProps {
  onClose: () => void;
  /** Row to highlight — the score this player just saved. */
  highlightId?: string | null;
}

export default function RankingPanel({
  onClose,
  highlightId,
}: RankingPanelProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [message, setMessage] = useState("");

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchScores().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setEntries(result.entries);
        setStatus("ok");
      } else {
        setMessage(result.message);
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  /** RETRY: setState in an event handler is fine. */
  const retry = useCallback(() => {
    setStatus("loading");
    setMessage("");
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/85 p-4 backdrop-blur-sm">
      <div className="kb-panel flex max-h-[85vh] w-full max-w-xl flex-col rounded-lg bg-surface">
        <div className="flex items-center justify-between border-b-2 border-surface-2 px-5 py-4">
          <h2 className="font-pixel text-base text-accent sm:text-lg">RANKING</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-pixel text-[10px] text-muted transition-colors hover:text-bone"
          >
            CLOSE
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-4">
          {status === "loading" && (
            <p className="py-12 text-center text-sm text-muted">
              랭킹을 불러오는 중…
            </p>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="px-4 text-center text-sm text-primary">{message}</p>
              <button
                type="button"
                onClick={retry}
                className="kb-panel rounded-md bg-surface-2 px-4 py-2 font-pixel text-[10px] text-bone"
              >
                RETRY
              </button>
            </div>
          )}

          {status === "ok" && entries.length === 0 && (
            <p className="py-12 text-center text-sm text-muted">
              아직 기록이 없습니다. 첫 번째 파괴왕이 되어보세요.
            </p>
          )}

          {status === "ok" && entries.length > 0 && (
            <table className="w-full border-collapse">
              <thead>
                <tr className="font-pixel text-[9px] tracking-widest text-muted">
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">NAME</th>
                  <th className="px-2 py-2 text-right">DPM</th>
                  <th className="px-2 py-2 text-right">COMBO</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isMine = entry.id === highlightId;
                  const podium = PODIUM[entry.rank];
                  return (
                    <tr
                      key={entry.id}
                      className={`border-t border-surface-2 ${
                        podium?.row ?? ""
                      } ${isMine ? "bg-primary/20" : ""}`}
                    >
                      <td
                        className={`px-2 py-2.5 font-pixel tabular-nums ${
                          podium
                            ? `text-xs ${podium.rank}`
                            : "text-xs text-muted"
                        }`}
                      >
                        {podium?.label ?? entry.rank}
                      </td>
                      <td
                        className={`max-w-[10rem] truncate px-2 py-2.5 text-sm ${
                          podium?.name ?? "text-bone"
                        }`}
                      >
                        {entry.nickname}
                        {isMine && (
                          <span className="ml-2 font-pixel text-[8px] text-primary">
                            YOU
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-2 py-2.5 text-right font-pixel tabular-nums ${
                          podium?.dpm ?? "text-sm text-accent"
                        }`}
                      >
                        {entry.dpm}
                      </td>
                      <td className="px-2 py-2.5 text-right font-pixel text-xs tabular-nums text-muted">
                        {entry.maxCombo}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
