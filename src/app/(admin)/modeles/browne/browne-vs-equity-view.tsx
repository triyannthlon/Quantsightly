"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Info, ShieldCheck, TrendingUp, Trophy, Scale, Users, Map as MapIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider, TooltipBody } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RebalanceFrequency } from "@/lib/coredata/browne";
import type { BrowneComparisonRow } from "@/lib/coredata/browne-service";
import {
  fmtPct,
  fmtPts,
  fmtMonths,
  browneVsEquity,
  VERDICT_TONE,
  VERDICT_DESC,
  VERDICT_ORDER,
  COUNTRY_REGION,
  type BrowneRegion,
  type BrowneVsEquity,
} from "./helpers";
import { BrowneVsEquityMatrix } from "./browne-vs-equity-matrix";
import { BrowneHeatmap } from "./browne-heatmap";
import { BrowneMultiCompare } from "./browne-multi-compare";
import { BrowneVerdictMap } from "./browne-verdict-map";

interface Item {
  row: BrowneComparisonRow;
  ve: BrowneVsEquity;
}

const fmtSignedRatio = (v: number | null): string =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}`;

// ─── Cartes de synthèse ──────────────────────────────────────────────────────

function FlagsRow({ items, max = 6 }: { items: Item[]; max?: number }) {
  const shown = items.slice(0, max);
  const overflow = items.slice(max);
  return (
    <div className="mt-2 flex items-center gap-1">
      {shown.map((it) => (
        <CountryFlag
          key={it.row.countryCode}
          code={it.row.countryCode}
          countryName={it.row.countryFr ?? it.row.countryCode}
          size={16}
        />
      ))}
      {overflow.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-pointer rounded-md border bg-background/60 px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              +{overflow.length}
            </button>
          </TooltipTrigger>
          <TooltipContent className="flex max-w-[240px] flex-wrap gap-1.5">
            {overflow.map((it) => (
              <span key={it.row.countryCode} className="inline-flex items-center gap-1 text-[11px]">
                <CountryFlag code={it.row.countryCode} countryName={it.row.countryFr ?? it.row.countryCode} size={14} />
                <span className="font-medium tabular-nums">{it.row.countryCode}</span>
              </span>
            ))}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function CardHead({
  icon: Icon,
  label,
  desc,
  formula,
}: {
  icon: typeof ShieldCheck;
  label: string;
  desc: string;
  formula?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase opacity-80">
      <Icon className="size-3.5 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="cursor-help opacity-70 hover:opacity-100">
            <Info className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 normal-case">
          <TooltipBody title={label} formula={formula}>
            {desc}
          </TooltipBody>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function CountCard({
  icon: Icon,
  label,
  desc,
  tone,
  items,
}: {
  icon: typeof ShieldCheck;
  label: string;
  desc: string;
  tone: string;
  items: Item[];
}) {
  return (
    <Card className={cn("gap-0 p-4", tone)}>
      <CardHead icon={Icon} label={label} desc={desc} />
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {items.length}
        <span className="ml-1 text-sm font-normal opacity-70">pays</span>
      </div>
      {items.length > 0 && <FlagsRow items={items} />}
    </Card>
  );
}

function LeaderCard({
  icon: Icon,
  label,
  desc,
  formula,
  tone,
  item,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  desc: string;
  formula?: string;
  tone: string;
  item: Item | null;
  value: string;
}) {
  return (
    <Card className={cn("gap-0 p-4", tone)}>
      <CardHead icon={Icon} label={label} desc={desc} formula={formula} />
      {item ? (
        <>
          <div className="mt-1 flex items-center gap-2">
            <CountryFlag code={item.row.countryCode} countryName={item.row.countryFr ?? item.row.countryCode} size={18} />
            <span className="truncate font-semibold">{item.row.countryFr ?? item.row.countryCode}</span>
          </div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
        </>
      ) : (
        <div className="mt-1 text-sm text-muted-foreground">—</div>
      )}
    </Card>
  );
}

// ─── Colonnes du tableau ─────────────────────────────────────────────────────

interface NumCol {
  key: string;
  label: string;
  tip: string;
  get: (it: Item) => number | null;
  fmt: (it: Item) => string;
  better: "asc" | "desc";
}

const COLS: NumCol[] = [
  { key: "br", label: "Browne réel", tip: "Rendement réel annualisé du portefeuille Browne.", get: (it) => it.row.real?.annualized ?? null, fmt: (it) => fmtPct(it.row.real?.annualized), better: "desc" },
  { key: "act", label: "Actions réelles", tip: "Rendement réel annualisé de l’indice actions local.", get: (it) => it.row.equityReal?.annualized ?? null, fmt: (it) => fmtPct(it.row.equityReal?.annualized), better: "desc" },
  { key: "er", label: "Écart rendement", tip: "Rendement Browne − Rendement Actions (points).", get: (it) => it.ve.ecartReturn, fmt: (it) => fmtPts(it.ve.ecartReturn), better: "desc" },
  { key: "ev", label: "Écart volatilité", tip: "Volatilité Browne − Volatilité Actions (points) : négatif = Browne moins volatil.", get: (it) => it.ve.ecartVol, fmt: (it) => fmtPts(it.ve.ecartVol), better: "asc" },
  { key: "dd", label: "Réduction drawdown", tip: "|Max DD Actions| − |Max DD Browne| (points) : positif = Browne protège mieux.", get: (it) => it.ve.drawdownReduction, fmt: (it) => fmtPts(it.ve.drawdownReduction), better: "desc" },
  { key: "es", label: "Écart Sharpe", tip: "Sharpe Browne − Sharpe Actions.", get: (it) => it.ve.ecartSharpe, fmt: (it) => fmtSignedRatio(it.ve.ecartSharpe), better: "desc" },
  { key: "uwB", label: "Sous l’eau Browne", tip: "Plus longue durée sous le dernier sommet (Browne).", get: (it) => it.row.real?.maxUnderwaterMonths ?? null, fmt: (it) => fmtMonths(it.row.real?.maxUnderwaterMonths), better: "asc" },
  { key: "uwA", label: "Sous l’eau Actions", tip: "Plus longue durée sous le dernier sommet (Actions).", get: (it) => it.row.equityReal?.maxUnderwaterMonths ?? null, fmt: (it) => fmtMonths(it.row.equityReal?.maxUnderwaterMonths), better: "asc" },
];

const verdictRank = (it: Item) => (it.ve.verdict ? VERDICT_ORDER.indexOf(it.ve.verdict) : 99);

export function BrowneVsEquityView({
  rows,
  loading,
  onPick,
  region,
  rebalance,
  periodYears,
}: {
  rows: BrowneComparisonRow[] | null;
  loading: boolean;
  onPick: (iso: string) => void;
  region: BrowneRegion;
  rebalance: RebalanceFrequency;
  periodYears: number | null;
}) {
  const [sortKey, setSortKey] = useState("dd");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCompare, setShowCompare] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const items = useMemo<Item[]>(() => {
    return (rows ?? [])
      .filter((r) => region === "monde" || COUNTRY_REGION[r.countryCode] === region)
      .map((r) => ({ row: r, ve: browneVsEquity(r) }))
      .filter((it) => it.ve.verdict != null);
  }, [rows, region]);

  const cards = useMemo(() => {
    const superieur = items.filter((it) => it.ve.verdict === "Supérieur aux actions");
    const excellent = items.filter((it) => it.ve.verdict === "Excellent compromis");
    const byDd = [...items].filter((it) => it.ve.drawdownReduction != null).sort((a, b) => b.ve.drawdownReduction! - a.ve.drawdownReduction!);
    const bySharpe = [...items].filter((it) => it.ve.ecartSharpe != null).sort((a, b) => b.ve.ecartSharpe! - a.ve.ecartSharpe!);
    return { superieur, excellent, topDd: byDd[0] ?? null, topSharpe: bySharpe[0] ?? null };
  }, [items]);

  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.key === sortKey);
    const sign = dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sortKey === "verdict") return (verdictRank(a) - verdictRank(b)) * sign;
      const va = col?.get(a) ?? null;
      const vb = col?.get(b) ?? null;
      if (va === null && vb === null) return (a.row.countryFr ?? "").localeCompare(b.row.countryFr ?? "", "fr");
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va - vb) * sign;
    });
  }, [items, sortKey, dir]);

  function toggle(key: string, better: "asc" | "desc") {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(better);
    }
  }

  if (!rows && loading) {
    return (
      <Card className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Calcul de la comparaison…
      </Card>
    );
  }
  if (!items.length) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Aucune donnée Browne vs Actions disponible.
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("space-y-4", loading && "opacity-60 transition-opacity")}>
        {/* Cartes de synthèse */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <CountCard
            icon={TrendingUp}
            label="Supérieur aux actions"
            desc="Nombre de pays où le portefeuille Browne fait mieux que l’indice actions local en rendement, tout en réduisant le risque."
            tone="border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.06] to-transparent"
            items={cards.superieur}
          />
          <CountCard
            icon={Scale}
            label="Excellent compromis"
            desc="Nombre de pays où Browne fait presque aussi bien que les actions, mais avec une baisse maximale beaucoup plus faible."
            tone="border-cyan-500/25 bg-gradient-to-b from-cyan-500/[0.06] to-transparent"
            items={cards.excellent}
          />
          <LeaderCard
            icon={ShieldCheck}
            label="Réduction drawdown"
            desc="Pays où Browne réduit le plus la perte maximale par rapport à l’indice actions local."
            formula="|Max DD actions| − |Max DD Browne|"
            tone="border-amber-500/25 bg-gradient-to-b from-amber-500/[0.06] to-transparent"
            item={cards.topDd}
            value={fmtPts(cards.topDd?.ve.drawdownReduction ?? null)}
          />
          <LeaderCard
            icon={Trophy}
            label="Gain risque/rendement"
            desc="Pays où Browne améliore le plus le rendement obtenu par unité de risque."
            formula="Sharpe Browne − Sharpe actions"
            tone="border-violet-500/25 bg-gradient-to-b from-violet-500/[0.06] to-transparent"
            item={cards.topSharpe}
            value={fmtSignedRatio(cards.topSharpe?.ve.ecartSharpe ?? null)}
          />
        </div>

        {/* Matrice */}
        <Card className="gap-0 p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">Compromis Browne vs Actions</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="cursor-help text-muted-foreground/60 hover:text-foreground">
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-72">
                Chaque point représente un pays. Le graphique montre si Browne améliore le rendement
                (vertical) et/ou réduit le drawdown (horizontal) par rapport aux actions locales.
                Couleur = verdict. Cliquez un point pour ouvrir sa vue pays.
              </TooltipContent>
            </Tooltip>
          </div>
          <BrowneVsEquityMatrix rows={items.map((it) => it.row)} onPick={onPick} />
        </Card>

        {/* Tableau */}
        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b p-4">
            <h3 className="text-sm font-semibold">Détail par pays</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sorted.length} pays · triez les colonnes ou cliquez sur un pays pour ouvrir sa vue détaillée.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Pays</th>
                  <th className="px-3 py-2 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => toggle("verdict", "asc")}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                    >
                      <span className={cn(sortKey === "verdict" && "text-foreground")}>Verdict</span>
                      {sortKey === "verdict" ? (
                        dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  </th>
                  {COLS.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => toggle(c.key, c.better)}
                        className="ml-auto inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(sortKey === c.key && "text-foreground")}>{c.label}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-56">
                            {c.tip}
                          </TooltipContent>
                        </Tooltip>
                        {sortKey === c.key ? (
                          dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((it) => (
                  <tr
                    key={it.row.countryCode}
                    onClick={() => onPick(it.row.countryCode)}
                    className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <CountryFlag code={it.row.countryCode} countryName={it.row.countryFr ?? it.row.countryCode} size={18} />
                        <span className="font-medium">{it.row.countryFr ?? it.row.countryCode}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {it.ve.verdict && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "inline-block min-w-[150px] cursor-help rounded-md border px-2 py-0.5 text-center text-[11px] font-medium whitespace-nowrap",
                                VERDICT_TONE[it.ve.verdict],
                              )}
                            >
                              {it.ve.verdict}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-60">
                            {VERDICT_DESC[it.ve.verdict]}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                    {COLS.map((c) => (
                      <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">
                        {c.fmt(it)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Heatmap de régularité */}
        <Card className="gap-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold">Régularité par horizon</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="cursor-help text-muted-foreground/60 hover:text-foreground">
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-72">
                  Taux de réussite de Browne selon la durée de détention, sur deux mesures : gagner du
                  pouvoir d’achat (bat l’inflation) ou faire mieux que les actions locales. Plus c’est
                  vert, plus c’est fréquent.
                </TooltipContent>
              </Tooltip>
            </div>
            <button
              type="button"
              onClick={() => setShowHeatmap((v) => !v)}
              className="cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showHeatmap ? "Masquer" : "Afficher"}
            </button>
          </div>
          {showHeatmap && (
            <div className="mt-3">
              <BrowneHeatmap rows={items.map((it) => it.row)} onPick={onPick} />
            </div>
          )}
        </Card>

        {/* Comparateur multi-pays */}
        <Card className="gap-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Users className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Comparer des pays</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCompare((v) => !v)}
              className="cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showCompare ? "Masquer" : "Ouvrir le comparateur"}
            </button>
          </div>
          {showCompare && (
            <div className="mt-3">
              <BrowneMultiCompare
                rows={items.map((it) => it.row)}
                rebalance={rebalance}
                years={periodYears}
                onPick={onPick}
              />
            </div>
          )}
        </Card>

        {/* Carte internationale des verdicts (optionnelle, charge la géo à la demande) */}
        <Card className="gap-0 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <MapIcon className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Carte internationale des verdicts</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showMap ? "Masquer" : "Afficher la carte"}
            </button>
          </div>
          {showMap && (
            <div className="mt-3">
              <BrowneVerdictMap rows={items.map((it) => it.row)} region={region} />
            </div>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}
