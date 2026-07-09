"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SLEEVE_KEYS, type BrowneResult, type SleeveKey } from "@/lib/coredata/browne";
import type { CountryBrowneConfig, SleeveConfig, SleeveQuality } from "@/lib/coredata/browne-service";
import { ExplorationChart, type ChartLine } from "../../exploration/exploration-chart";
import { drawdownSeries, mergeChart, fmtPct, fmtMonths } from "./helpers";

type OkResult = Extract<BrowneResult, { status: "OK" }>;

const SLEEVE_COLOR: Record<SleeveKey, string> = {
  equity: "#5B9BF5",
  bond: "#57C198",
  cash: "#8794A6",
  gold: "#E9AF4B",
};
const SLEEVE_LABEL: Record<SleeveKey, string> = {
  equity: "Actions",
  bond: "Obligations 10 ans",
  cash: "Cash",
  gold: "Or",
};

// ─── Graphique de drawdown ───────────────────────────────────────────────────

export function DrawdownCard({ result }: { result: OkResult }) {
  const chart = useMemo(() => {
    const data = mergeChart([
      { key: "browne", data: drawdownSeries(result.series.nominal) },
      { key: "equity", data: drawdownSeries(result.series.equityBenchmark) },
    ]);
    const lines: ChartLine[] = [
      { key: "browne", label: "Browne", color: "#E8833A" },
      { key: "equity", label: "Actions", color: "#5B9BF5" },
    ];
    return { data, lines };
  }, [result]);

  const nom = result.metrics.nominal.maxDrawdown;
  const eq = result.metrics.equity.maxDrawdown;
  const reduction = nom !== null && eq !== null ? nom - eq : null; // > 0 = creux plus faible

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Drawdown (perte depuis le sommet)</h3>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Max DD Browne" value={fmtPct(nom)} />
        <Stat label="Max DD actions" value={fmtPct(eq)} />
        <Stat label="Réduction" value={reduction === null ? "—" : `+${reduction.toFixed(1)} pts`} />
        <Stat label="Temps max sous l’eau" value={fmtMonths(result.metrics.nominal.maxUnderwaterMonths)} />
      </div>
      <ExplorationChart data={chart.data} lines={chart.lines} height={240} />
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// ─── Composition ─────────────────────────────────────────────────────────────

export function CompositionCard({ config }: { config: CountryBrowneConfig }) {
  const sleeves: SleeveConfig[] = [config.equity, config.bond, config.cash, config.gold];
  return (
    <Card className="p-4">
      <h3 className="mb-1 text-sm font-semibold">Composition</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Quatre poches équipondérées, rééquilibrées à 25 %.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Poche</TableHead>
              <TableHead className="text-right">Poids</TableHead>
              <TableHead>Série</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Devise</TableHead>
              <TableHead>Méthode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sleeves.map((s) => (
              <TableRow key={s.label}>
                <TableCell className="font-medium">{s.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {Math.round(s.weight * 100)} %
                </TableCell>
                <TableCell>{s.tickerName}</TableCell>
                <TableCell className="text-muted-foreground">{s.typeFr ?? "—"}</TableCell>
                <TableCell>{s.currency}</TableCell>
                <TableCell className="text-muted-foreground">{s.method}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// ─── Sources de performance (contributions) ──────────────────────────────────

const CONTRIB_TOOLTIP =
  "Les contributions brutes additionnent les effets mensuels poids × rendement. " +
  "Lorsqu’elles sont toutes positives, elles sont normalisées à 100 % pour faciliter " +
  "la lecture. Cette mesure indique quelles poches ont le plus porté la performance, " +
  "sans représenter directement la part du gain final capitalisé.";

export function ContributionCard({ result }: { result: OkResult }) {
  const rows = SLEEVE_KEYS.map((k) => ({
    key: k,
    label: SLEEVE_LABEL[k],
    color: SLEEVE_COLOR[k],
    raw: result.metrics.sleeves[k].contribution,
  }));

  const values = rows.map((r) => r.raw);
  const allPositive = values.every((v) => v !== null && v > 0);
  const total = allPositive ? values.reduce<number>((s, v) => s + (v ?? 0), 0) : 0;
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v ?? 0)));

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold">Sources de performance</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground/60 hover:text-foreground">
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-80">
            {CONTRIB_TOOLTIP}
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Répartition des contributions cumulées des quatre poches
        {allPositive ? " (normalisée à 100 %)." : " (contributions brutes, une poche négative)."}
      </p>
      <div className="space-y-2">
        {rows.map((r) => {
          const share = allPositive && r.raw !== null && total > 0 ? (r.raw / total) * 100 : null;
          const width = allPositive
            ? (share ?? 0)
            : (Math.abs(r.raw ?? 0) / maxAbs) * 100;
          return (
            <div key={r.key} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-2 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="h-2 rounded-full bg-muted">
                <span
                  className="block h-2 rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, width))}%`, backgroundColor: r.color }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">
                {share !== null ? `${share.toFixed(0)} %` : fmtPct(r.raw, true)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Qualité des données ─────────────────────────────────────────────────────

const SLEEVE_QUALITY_TOOLTIP =
  "Série reconstruite par méthode standard lorsque l’indice directement investissable " +
  "n’est pas disponible. Ce proxy fait partie de la méthodologie normale du modèle.";

function SleeveQualityBadge({ quality }: { quality: SleeveQuality }) {
  const attention = quality === "Repli";
  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        attention && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {quality}
    </Badge>
  );
  if (quality !== "Proxy structurel") return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        {SLEEVE_QUALITY_TOOLTIP}
      </TooltipContent>
    </Tooltip>
  );
}

export function DataQualityCard({ config }: { config: CountryBrowneConfig }) {
  const rows: { label: string; method: string; quality: SleeveQuality }[] = [
    { label: "Actions", method: config.equity.method, quality: config.equity.quality },
    { label: "Obligations 10 ans", method: config.bond.method, quality: config.bond.quality },
    { label: "Cash", method: config.cash.method, quality: config.cash.quality },
    { label: "Or", method: config.gold.method, quality: config.gold.quality },
  ];
  if (config.inflation) {
    rows.push({
      label: "Inflation",
      method: config.inflation.method,
      quality: config.inflation.quality,
    });
  }

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Qualité des données</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
            <div>
              <div className="font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.method}</div>
            </div>
            <SleeveQualityBadge quality={r.quality} />
          </div>
        ))}
      </div>
    </Card>
  );
}
