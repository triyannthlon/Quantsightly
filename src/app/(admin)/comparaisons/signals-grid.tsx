"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dialog, DialogTitle, FrostedDialogContent } from "@/components/custom/ui/frosted-dialog";
import { ExplorationChart, type ChartPoint } from "../exploration/exploration-chart";
import type { SeriesKpis } from "@/lib/coredata/compute";
import type { SignalEconomic } from "./signals";
import type { TechnicalState, DisplayState } from "./signal-classify";

export interface SignalView {
  id: string;
  title: string;
  meaning: string;
  tooltip: string;
  valueNote?: string;
  maYears: number;
  chartData: ChartPoint[];
  lastValue: number | null;
  economic: SignalEconomic;
  technicalState: TechnicalState | null;
  displayState: DisplayState | null;
  ecart: number | null;
  kpis: SeriesKpis;
  phrase: string;
  exploreHref: string;
}

const COLOR_RATIO = "var(--foreground)";
const COLOR_MA = "#E8833A";

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

function economicClass(tone: "positive" | "negative" | "neutral"): string {
  if (tone === "positive")
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (tone === "negative")
    return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
  return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

function subText(view: SignalView): string {
  if (view.displayState === "transition") {
    return view.ecart !== null
      ? `À ${(Math.abs(view.ecart) * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} % de la MM7`
      : "Proche de la MM7";
  }
  if (view.technicalState === "above") return "Au-dessus de la MM7";
  if (view.technicalState === "below") return "Sous la MM7";
  return "Proche de la MM7";
}

function Perf({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xs tabular-nums", pctTone(value))}>{formatPct(value)}</span>
    </div>
  );
}

function SignalCard({ view }: { view: SignalView }) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const lines = [
    { key: "ratio", label: "Ratio", color: COLOR_RATIO },
    { key: "ma", label: `MM ${view.maYears} ans`, color: COLOR_MA, dashed: true },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{view.title}</h3>
          <div className="flex items-center gap-1">
            <p className="truncate text-xs text-muted-foreground">{view.meaning}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="cursor-help text-muted-foreground/70 hover:text-foreground">
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{view.tooltip}</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
              economicClass(view.economic.tone),
            )}
          >
            {view.economic.label}
          </span>
          <span className="text-[11px] text-muted-foreground">{subText(view)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setZoomOpen(true)}
        className="cursor-zoom-img block w-full"
        aria-label="Agrandir le graphique"
      >
        <ExplorationChart data={view.chartData} lines={lines} height={150} compact />
      </button>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <FrostedDialogContent
          className="max-h-[92vh] w-[92vw] max-w-[92vw] sm:max-w-[92vw]"
          showCloseButton
        >
          <DialogTitle className="text-center text-base font-medium">
            {view.title} — {view.meaning}
          </DialogTitle>
          <ExplorationChart data={view.chartData} lines={lines} height="78vh" />
        </FrostedDialogContent>
      </Dialog>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Ratio actuel
            {view.valueNote && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="cursor-help text-muted-foreground/70 hover:text-foreground">
                    <Info className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{view.valueNote}</TooltipContent>
              </Tooltip>
            )}
          </span>
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

      <p className="border-t pt-3 text-sm leading-relaxed text-foreground/90">{view.phrase}</p>

      <Link
        href={view.exploreHref}
        className="mt-auto inline-flex items-center gap-1 self-start pt-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Ouvrir dans le comparateur
        <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  );
}

export function SignalsGrid({ views }: { views: SignalView[] }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-1 gap-4 xl:auto-rows-fr xl:grid-cols-2">
        {views.map((v) => (
          <SignalCard key={v.id} view={v} />
        ))}
      </div>
    </TooltipProvider>
  );
}
