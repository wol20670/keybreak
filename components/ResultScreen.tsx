"use client";

import { useState } from "react";
import HudStat from "./HudStat";
import { MAX_NICKNAME_LENGTH } from "@/lib/game";
import type { ApiError, GameResult, RankingEntry } from "@/lib/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ResultScreenProps {
  result: GameResult;
  onRetry: () => void;
  onOpenRanking: (savedId: string | null) => void;
}

export default function ResultScreen({
  result,
  onRetry,
  onOpenRanking,
}: ResultScreenProps) {
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  const trimmed = nickname.trim();
  const canSave = trimmed.length > 0 && status !== "saving" && status !== "saved";

  async function save() {
    if (!canSave) return;
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: trimmed,
          dpm: result.dpm,
          totalHits: result.totalHits,
          maxCombo: result.maxCombo,
        }),
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        const error = data as ApiError;
        setMessage(error?.message ?? "기록 저장에 실패했습니다.");
        setStatus("error");
        return;
      }

      setSavedId((data as { score: RankingEntry }).score?.id ?? null);
      setStatus("saved");
      setMessage("기록이 저장되었습니다.");
    } catch {
      setMessage("네트워크 오류로 기록을 저장하지 못했습니다.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 px-4 py-8">
      <h2
        className="font-pixel text-2xl text-accent sm:text-4xl"
        style={{ textShadow: "0 4px 0 #26101a" }}
      >
        TIME UP
      </h2>

      <div className="kb-panel flex w-full max-w-lg flex-col items-center gap-5 rounded-lg bg-surface/80 px-5 py-7">
        <div className="flex flex-col items-center">
          <span className="font-pixel text-[10px] tracking-widest text-muted">
            FINAL DPM
          </span>
          <span
            className="font-pixel text-5xl tabular-nums text-primary sm:text-7xl"
            style={{ textShadow: "0 5px 0 #26101a" }}
          >
            {result.dpm}
          </span>
        </div>

        <div className="flex w-full items-start justify-around border-t-2 border-surface-2 pt-5">
          <HudStat label="HITS" value={result.totalHits} size="sm" />
          <HudStat
            label="MAX COMBO"
            value={result.maxCombo}
            tone="accent"
            size="sm"
          />
          <HudStat
            label="BOSS KILL"
            value={result.bossesDefeated}
            tone="primary"
            size="sm"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex w-full max-w-lg flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits; ASDF here types text and never attacks.
              if (e.key === "Enter") void save();
            }}
            maxLength={MAX_NICKNAME_LENGTH}
            disabled={status === "saved"}
            placeholder="닉네임 입력"
            aria-label="닉네임"
            className="kb-panel min-w-0 flex-1 rounded-md bg-ink px-4 py-3 text-sm text-bone outline-none placeholder:text-muted focus:border-primary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className="kb-panel shrink-0 rounded-md bg-accent px-5 py-3 font-pixel text-xs text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "saving" ? "..." : "SAVE"}
          </button>
        </div>

        {message && (
          <p
            role="status"
            className={`text-center text-xs ${
              status === "saved" ? "text-accent" : "text-primary"
            }`}
          >
            {message}
            {status === "error" && " 다시 시도하거나 랭킹을 확인해 보세요."}
          </p>
        )}

        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={() => onOpenRanking(savedId)}
            className="kb-panel flex-1 rounded-md bg-surface-2 px-4 py-3 font-pixel text-[11px] text-bone transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
          >
            RANKING
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="kb-panel flex-1 rounded-md bg-primary px-4 py-3 font-pixel text-[11px] text-bone transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
          >
            RETRY
          </button>
        </div>
      </div>
    </div>
  );
}
