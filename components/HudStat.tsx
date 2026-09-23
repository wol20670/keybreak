import { memo } from "react";

interface HudStatProps {
  label: string;
  value: string | number;
  tone?: "default" | "accent" | "primary";
  size?: "sm" | "md" | "lg";
}

const TONE: Record<NonNullable<HudStatProps["tone"]>, string> = {
  default: "text-bone",
  accent: "text-accent",
  primary: "text-primary",
};

const SIZE: Record<NonNullable<HudStatProps["size"]>, string> = {
  sm: "text-base sm:text-lg",
  md: "text-xl sm:text-2xl",
  lg: "text-3xl sm:text-4xl",
};

function HudStat({ label, value, tone = "default", size = "md" }: HudStatProps) {
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <span className="text-center font-pixel text-[9px] leading-tight tracking-widest text-muted sm:text-[10px]">
        {label}
      </span>
      <span
        className={`kb-display font-pixel tabular-nums ${SIZE[size]} ${TONE[tone]}`}
      >
        {value}
      </span>
    </div>
  );
}

export default memo(HudStat);
