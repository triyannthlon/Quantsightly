import { Activity, Gauge } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuadrantModelResult } from "@/lib/coredata/four-quadrants";
import {
  regimeStyleOf,
  REGIME_PHRASE,
  conviction,
  CONVICTION_TONE,
  whyAllocation,
  movementSentence,
  accelerationSentence,
  SLEEVE_META,
  CORE_SLEEVES,
  fmtPct0,
} from "./helpers";

export function DecisionPanel({ r }: { r: QuadrantModelResult }) {
  const regime = regimeStyleOf(r.quadrant);
  const conv = conviction(r.x, r.y);
  const sleeves = [...CORE_SLEEVES].sort((a, b) => r.finalAllocation[b] - r.finalAllocation[a]);

  return (
    <Card className="gap-0 p-5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Régime actuel</p>
      <h2 className={cn("mt-1 text-2xl font-semibold", regime.text)}>{regime.label}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{REGIME_PHRASE[r.quadrant]}</p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {/* Allocation recommandée — la donnée principale */}
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Allocation recommandée</p>
          <div className="mt-3 space-y-2.5">
            {sleeves.map((k) => {
              const w = r.finalAllocation[k];
              const meta = SLEEVE_META[k];
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: meta.hex }} />
                      <span className="font-medium">{meta.label}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{fmtPct0(w)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/40">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, w * 100)}%`, background: meta.hex }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conviction + pourquoi + dynamique */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Conviction</p>
            <p className="mt-1 text-lg font-semibold">{conv.level}</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/40">
              <div className={cn("h-full rounded-full", CONVICTION_TONE[conv.level])} style={{ width: `${Math.round(conv.score)}%` }} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pourquoi ?</p>
            <p className="mt-1 text-sm">{whyAllocation(r)}</p>
          </div>

          <div className="space-y-1 border-t border-border/50 pt-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Activity className="size-4 shrink-0 opacity-70" />
              {movementSentence(r.velocity, r.radialVelocity)}
            </p>
            <p className="flex items-center gap-2">
              <Gauge className="size-4 shrink-0 opacity-70" />
              {accelerationSentence(r.velocity, r.acceleration)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
