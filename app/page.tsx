"use client";

import { useState } from "react";
import CountdownScreen from "@/components/CountdownScreen";
import GameScreen from "@/components/GameScreen";
import MuteButton from "@/components/MuteButton";
import RankingPanel from "@/components/RankingPanel";
import ResultScreen from "@/components/ResultScreen";
import StartScreen from "@/components/StartScreen";
import { useKeybreakGame } from "@/hooks/useKeybreakGame";

export default function Home() {
  const { phase, countdownIndex, snapshot, result, startGame, retry, backToStart } =
    useKeybreakGame();

  const [rankingOpen, setRankingOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  return (
    <main className="kb-dungeon kb-scanlines kb-vignette relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <MuteButton />

      {phase === "START" && (
        <StartScreen
          onStart={startGame}
          onOpenRanking={() => {
            setHighlightId(null);
            setRankingOpen(true);
          }}
        />
      )}

      {phase === "COUNTDOWN" && <CountdownScreen index={countdownIndex} />}

      {phase === "PLAYING" && <GameScreen snapshot={snapshot} />}

      {phase === "RESULT" && result && (
        <ResultScreen
          result={result}
          onRetry={retry}
          onOpenRanking={(savedId) => {
            setHighlightId(savedId);
            setRankingOpen(true);
          }}
        />
      )}

      {phase === "RESULT" && (
        <button
          type="button"
          onClick={backToStart}
          className="absolute left-4 top-4 font-pixel text-[10px] text-muted transition-colors hover:text-bone"
        >
          ← HOME
        </button>
      )}

      {rankingOpen && (
        <RankingPanel
          highlightId={highlightId}
          onClose={() => setRankingOpen(false)}
        />
      )}
    </main>
  );
}
