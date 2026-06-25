"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Trash2, PinOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ExplorationChart,
  type ChartLine,
  type ChartPoint,
} from "../../exploration/exploration-chart";
import type { SeriesKpis } from "@/lib/coredata/compute";
import { deleteComparison } from "../comparison-client";

export interface SavedView {
  id: string;
  title: string;
  chartData: ChartPoint[];
  lines: ChartLine[];
  kpis: SeriesKpis;
  lastValue: number | null;
  exploreHref: string;
}

function formatValue(v: number | null): string {
  if (v === null) return "—";
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
  return v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPct(v: number | null): string {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function pctTone(v: number | null): string {
  if (v === null) return "text-muted-foreground";
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "text-foreground";
}

function Perf({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xs tabular-nums", pctTone(value))}>{formatPct(value)}</span>
    </div>
  );
}

function Card({ view, onDelete }: { view: SavedView; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold">{view.title}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 cursor-pointer text-muted-foreground hover:text-red-500"
          onClick={onDelete}
          title="Retirer"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <ExplorationChart data={view.chartData} lines={view.lines} height={150} compact />

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[11px] text-muted-foreground">Dernière valeur</span>
          <span className="font-mono text-base font-semibold tabular-nums">
            {formatValue(view.lastValue)}
          </span>
        </div>
        <div className="flex gap-4">
          <Perf label="1 mois" value={view.kpis.lastMonth} />
          <Perf label="1 an" value={view.kpis.oneYear} />
          <Perf label="3 ans" value={view.kpis.threeYear} />
          <Perf label="5 ans" value={view.kpis.fiveYear} />
        </div>
      </div>

      <Link
        href={view.exploreHref}
        className="inline-flex items-center gap-1 self-start border-t pt-3 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Ouvrir dans le comparateur
        <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  );
}

export function MesComparaisonsGrid({ initial }: { initial: SavedView[] }) {
  const [views, setViews] = useState(initial);

  async function handleDelete(id: string) {
    setViews((v) => v.filter((x) => x.id !== id));
    const ok = await deleteComparison(id);
    toast[ok ? "info" : "error"](ok ? "Comparaison retirée" : "Échec de la suppression");
  }

  if (views.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted/50 py-20 text-center">
        <div className="rounded-full bg-primary/10 p-3">
          <PinOff className="size-6 text-primary" />
        </div>
        <div className="space-y-1 max-w-sm">
          <p className="text-base font-semibold">Aucune comparaison épinglée</p>
          <p className="text-sm text-muted-foreground">
            Construisez un graphique dans le comparateur, puis cliquez sur « Épingler » pour le
            retrouver ici.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/exploration">Ouvrir le comparateur</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {views.map((v) => (
        <Card key={v.id} view={v} onDelete={() => handleDelete(v.id)} />
      ))}
    </div>
  );
}
