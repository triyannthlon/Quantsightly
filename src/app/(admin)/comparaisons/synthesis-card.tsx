import { cn } from "@/lib/utils";
import type { RegimeReading } from "./regime-reading";
import type { DisplayState, Confidence } from "./signal-classify";

function chipClass(tone: "positive" | "negative" | "neutral"): string {
  if (tone === "positive")
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (tone === "negative")
    return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
  return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

function confidenceClass(c: Confidence): string {
  if (c === "forte")
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (c === "moyenne")
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "border-border bg-muted text-muted-foreground";
}

function axisState(state: DisplayState | null, pos: string, neg: string): string {
  if (state === "positive") return pos;
  if (state === "negative") return neg;
  if (state === "transition") return "en transition";
  return "—";
}

export function SynthesisCard({ reading }: { reading: RegimeReading }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Lecture actuelle du régime</h2>
        <div className="flex flex-wrap gap-2">
          {reading.chips.map((c, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                chipClass(c.tone),
              )}
            >
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Régime probable</p>
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
              confidenceClass(reading.confidence),
            )}
          >
            Confiance : {reading.confidence}
          </span>
        </div>
        <p className="text-base font-semibold">
          {reading.regimeLabel}
          {reading.regimeNote && (
            <span className="font-normal text-muted-foreground"> · {reading.regimeNote}</span>
          )}
        </p>
        {reading.transitionSignal && (
          <p className="text-xs text-muted-foreground">
            Signal en transition : {reading.transitionSignal}
          </p>
        )}
        {reading.confidence === "faible" && reading.lastConfirmed && (
          <p className="text-xs text-muted-foreground">
            Dernier régime confirmé : {reading.lastConfirmed}
          </p>
        )}
      </div>

      <p className="text-sm leading-relaxed text-foreground/90">{reading.synthesis}</p>

      <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Axe 1 — efficacité énergétique</p>
          <p className="text-sm font-medium">
            S&amp;P 500 / WTI ·{" "}
            <span className="text-muted-foreground">
              {axisState(reading.energyState, "efficace", "peu efficace")}
            </span>
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Axe 2 — qualité de la devise</p>
          <p className="text-sm font-medium">
            Oblig. longues / Or ·{" "}
            <span className="text-muted-foreground">
              {axisState(reading.currencyState, "solide", "fragile")}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
