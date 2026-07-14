import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuadrantModelResult } from "@/lib/coredata/four-quadrants";
import { conviction, TRANSITION_LABELS, fmtCoord } from "./helpers";

function SignalBar({
  label,
  value,
  positivePole,
  negativePole,
}: {
  label: string;
  value: number;
  positivePole: string;
  negativePole: string;
}) {
  const pos = value >= 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold tabular-nums">{fmtCoord(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn("h-full rounded-full", pos ? "bg-primary/70" : "bg-slate-400")}
          style={{ width: `${Math.min(100, Math.abs(value))}%` }}
        />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{pos ? positivePole : negativePole}</p>
    </div>
  );
}

export function SignalsPanel({ r }: { r: QuadrantModelResult }) {
  const conv = conviction(r.x, r.y);
  return (
    <Card className="gap-0 p-4">
      <h3 className="text-sm font-semibold">Pourquoi l’allocation change ?</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Les deux signaux qui déterminent le régime et l’allocation cible.
      </p>
      <div className="mt-3 space-y-3.5">
        <SignalBar
          label="Activité (actions / pétrole)"
          value={r.x}
          positivePole="Expansion — favorable aux actions"
          negativePole="Contraction — favorable aux liquidités"
        />
        <SignalBar
          label="Inflation (or / obligations)"
          value={r.y}
          positivePole="Inflation — favorable à l’or"
          negativePole="Désinflation — favorable aux obligations"
        />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-sm">
        <span className="text-muted-foreground">Transition</span>
        <span className="font-medium">{TRANSITION_LABELS[r.transitionState]}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Conviction</span>
        <span className="font-medium">{conv.level}</span>
      </div>
    </Card>
  );
}
