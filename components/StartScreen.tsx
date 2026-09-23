"use client";

import { useSyncExternalStore } from "react";
import KeyPad from "./KeyPad";
import { GAME_DURATION_SEC } from "@/lib/game";

const COARSE = "(pointer: coarse)";
const FINE = "(pointer: fine)";

function subscribePointer(onChange: () => void) {
  const coarse = window.matchMedia(COARSE);
  const fine = window.matchMedia(FINE);
  coarse.addEventListener("change", onChange);
  fine.addEventListener("change", onChange);
  return () => {
    coarse.removeEventListener("change", onChange);
    fine.removeEventListener("change", onChange);
  };
}

/** Touch-only: no physical keyboard, so the game cannot be played. */
function getPointerSnapshot() {
  return (
    window.matchMedia(COARSE).matches && !window.matchMedia(FINE).matches
  );
}

interface StartScreenProps {
  onStart: () => void;
  onOpenRanking: () => void;
}

export default function StartScreen({
  onStart,
  onOpenRanking,
}: StartScreenProps) {
  // Assume a keyboard during SSR, then correct on hydration.
  const isTouchOnly = useSyncExternalStore(
    subscribePointer,
    getPointerSnapshot,
    () => false,
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="font-pixel text-[10px] tracking-[0.35em] text-primary/70">
          <span className="text-muted">$</span> keybreak --debug
        </p>
        <h1 className="kb-logo font-pixel text-3xl leading-tight text-bone sm:text-6xl">
          KEYBREAK
        </h1>
        <p className="font-pixel text-[10px] font-bold tracking-[0.25em] text-accent sm:text-xs">
          BREAK THE BUG. SAVE YOUR SANITY.
        </p>
        <p className="mt-2 text-sm text-bone sm:text-base">
          30초 동안 폭주한 시스템을 때려잡는 디버깅 보스 레이드.
        </p>
      </div>

      <div className="kb-panel flex w-full max-w-md flex-col items-center gap-4 rounded-lg bg-surface/70 px-5 py-6">
        <p className="self-start font-pixel text-[10px] tracking-widest text-muted">
          <span className="text-primary/60">{"//"}</span> HOW TO PLAY
        </p>
        <KeyPad activeKeys={[]} size="sm" />
        <p className="text-sm text-bone">
          <strong className="font-pixel font-bold text-accent">
            {GAME_DURATION_SEC}초
          </strong>{" "}
          동안{" "}
          <strong className="font-pixel font-bold text-primary">
            A · S · D · F
          </strong>{" "}
          키를 최대한 빠르게 연타해 폭주한 프로세스를 강제 종료하세요.
        </p>
        <p className="text-xs leading-relaxed text-muted">
          입력 속도를 DPM으로 측정합니다. 키를 꾹 누르고 있는 것은 점수에
          반영되지 않습니다.
        </p>
      </div>

      {isTouchOnly && (
        <p className="max-w-md rounded-md border border-accent/50 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
          <span className="font-pixel font-bold tracking-widest">
            ⚠ WARNING{" "}
          </span>
          이 게임은 물리 키보드가 필요합니다. 데스크톱 브라우저에서 접속해
          플레이해 주세요. 랭킹은 지금도 확인할 수 있습니다.
        </p>
      )}

      <div className="flex w-full max-w-md flex-col items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          disabled={isTouchOnly}
          className="kb-panel kb-glow kb-display w-full rounded-md bg-primary px-8 py-4 font-pixel text-lg text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:animate-none sm:text-xl"
        >
          START
        </button>
        <button
          type="button"
          onClick={onOpenRanking}
          className="kb-panel w-full rounded-md bg-surface-2 px-8 py-3 font-pixel text-xs tracking-widest text-bone transition-transform hover:-translate-y-0.5 active:translate-y-0.5 sm:text-sm"
        >
          RANKING
        </button>
      </div>
    </div>
  );
}
