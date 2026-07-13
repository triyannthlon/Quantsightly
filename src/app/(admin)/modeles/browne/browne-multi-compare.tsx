"use client";

import { useEffect, useMemo, useState } from "react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EconomicDataPoint } from "@/lib/coredata/types";
import type { RebalanceFrequency } from "@/lib/coredata/browne";
import type { BrowneComparisonRow, BrowneRealSeries } from "@/lib/coredata/browne-service";
import { ExplorationChart, type ChartLine } from "../../exploration/exploration-chart";
import {
  mergeChart,
  drawdownSeries,
  fmtPct,
  fmtRatio,
  fmtMonths,
  browneVsEquity,
  VERDICT_TONE,
  VERDICT_DESC,
} from "./helpers";
import { loadBrowneRealSeries } from "./actions";

const MAX = 5;
const PALETTE = ["#E8833A", "#60a5fa", "#2dd4bf", "#a78bfa", "#f472b6"];

/** Rebase une série à 100 sur sa première valeur (après clip éventuel). */
function rebase(series: EconomicDataPoint[], from: string | null, to: string | null): EconomicDataPoint[] {
  let pts = series;
  if (from) pts = pts.filter((p) => p.date >= from);
  if (to) pts = pts.filter((p) => p.date <= to);
  if (pts.length < 2 || pts[0].value <= 0) return [];
  const v0 = pts[0].value;
  return pts.map((p) => ({ date: p.date, value: (100 * p.value) / v0 }));
}

export function BrowneMultiCompare({
  rows,
  rebalance,
  years,
  onPick,
}: {
  rows: BrowneComparisonRow[];
  rebalance: RebalanceFrequency;
  years: number | null;
  onPick: (iso: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [commonPeriod, setCommonPeriod] = useState(true);
  const [series, setSeries] = useState<BrowneRealSeries[]>([]);
  const [loading, setLoading] = useState(false);

  const rowByIso = useMemo(() => new Map(rows.map((r) => [r.countryCode, r])), [rows]);
  const colorOf = (iso: string) => PALETTE[selected.indexOf(iso) % PALETTE.length];

  useEffect(() => {
    if (selected.length < 2) {
      setSeries([]);
      return;
    }
    let ignore = false;
    setLoading(true);
    loadBrowneRealSeries(selected, rebalance, years)
      .then((s) => {
        if (!ignore) setSeries(s);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [selected, rebalance, years]);

  function toggle(iso: string) {
    setSelected((cur) =>
      cur.includes(iso) ? cur.filter((c) => c !== iso) : cur.length >= MAX ? cur : [...cur, iso],
    );
  }

  // Fenêtre commune (intersection) si activée.
  const { perf, drawdown, chartLines } = useMemo(() => {
    const valid = series.filter((s) => s.real && s.real.length > 1);
    let from: string | null = null;
    let to: string | null = null;
    if (commonPeriod && valid.length) {
      from = valid.map((s) => s.real![0].date).reduce((a, b) => (a > b ? a : b));
      to = valid.map((s) => s.real![s.real!.length - 1].date).reduce((a, b) => (a < b ? a : b));
    }
    const curves = valid.map((s) => ({ iso: s.countryCode, curve: rebase(s.real!, from, to) }));
    const chartLines: ChartLine[] = curves.map((c) => ({
      key: c.iso,
      label: rowByIso.get(c.iso)?.countryFr ?? c.iso,
      color: colorOf(c.iso),
      width: 2,
    }));
    const perf = mergeChart(curves.map((c) => ({ key: c.iso, data: c.curve })));
    const drawdown = mergeChart(curves.map((c) => ({ key: c.iso, data: drawdownSeries(c.curve) })));
    return { perf, drawdown, chartLines };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, commonPeriod, rowByIso]);

  const chosen = selected.map((iso) => rowByIso.get(iso)).filter((r): r is BrowneComparisonRow => !!r);

  return (
    <div>
      {/* Sélecteur de pays */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {rows.map((r) => {
          const active = selected.includes(r.countryCode);
          const full = !active && selected.length >= MAX;
          return (
            <button
              key={r.countryCode}
              type="button"
              disabled={full}
              onClick={() => toggle(r.countryCode)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                active
                  ? "text-foreground"
                  : full
                    ? "cursor-not-allowed border-transparent text-muted-foreground/30"
                    : "cursor-pointer border-transparent text-muted-foreground/60 hover:text-foreground",
              )}
              style={active ? { borderColor: colorOf(r.countryCode), color: colorOf(r.countryCode) } : undefined}
            >
              <CountryFlag code={r.countryCode} countryName={r.countryFr ?? r.countryCode} size={14} />
              {r.countryCode}
            </button>
          );
        })}
      </div>

      {selected.length < 2 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sélectionnez 2 à 5 pays pour comparer leurs trajectoires Browne réelles.
        </div>
      ) : (
        <div className={cn("space-y-4", loading && "opacity-60 transition-opacity")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {commonPeriod
                ? "Période commune : les courbes démarrent à 100 à la 1ʳᵉ date partagée par tous les pays."
                : "Chaque courbe démarre à 100 au début de son propre historique."}
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={commonPeriod}
                onChange={(e) => setCommonPeriod(e.target.checked)}
                className="cursor-pointer accent-primary"
              />
              Période commune
            </label>
          </div>

          {/* Performance Browne réelle */}
          <div>
            <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Performance Browne réelle (base 100)</h4>
            <ExplorationChart data={perf} lines={chartLines} height={300} gridOpacity={0.22} markLast axisLine cumulativeTooltip />
          </div>

          {/* Drawdown Browne réel */}
          <div>
            <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Drawdown Browne réel</h4>
            <ExplorationChart data={drawdown} lines={chartLines} height={220} gridOpacity={0.22} axisLine areaFill percentTooltip yDomain={[-60, 0]} />
          </div>

          {/* Tableau KPI comparatif */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Pays</th>
                  <th className="px-3 py-2 text-right font-medium">Robustesse</th>
                  <th className="px-3 py-2 text-right font-medium">Perf. réelle</th>
                  <th className="px-3 py-2 text-right font-medium">Vol. réelle</th>
                  <th className="px-3 py-2 text-right font-medium">Max DD réel</th>
                  <th className="px-3 py-2 text-right font-medium">Sous l’eau</th>
                  <th className="px-3 py-2 text-right font-medium">Sharpe réel</th>
                  <th className="px-3 py-2 text-left font-medium">Verdict vs actions</th>
                </tr>
              </thead>
              <tbody>
                {chosen.map((r) => {
                  const ve = browneVsEquity(r);
                  return (
                    <tr
                      key={r.countryCode}
                      onClick={() => onPick(r.countryCode)}
                      className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: colorOf(r.countryCode) }} />
                          <CountryFlag code={r.countryCode} countryName={r.countryFr ?? r.countryCode} size={16} />
                          <span className="font-medium">{r.countryFr ?? r.countryCode}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {r.robustness.available ? r.robustness.score : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(r.real?.annualized)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(r.real?.volatility)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(r.real?.maxDrawdown)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtMonths(r.real?.maxUnderwaterMonths)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtRatio(r.real?.sharpe)}</td>
                      <td className="px-3 py-2.5">
                        {ve.verdict && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={cn(
                                  "inline-block min-w-[150px] cursor-help rounded-md border px-2 py-0.5 text-center text-[11px] font-medium whitespace-nowrap",
                                  VERDICT_TONE[ve.verdict],
                                )}
                              >
                                {ve.verdict}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-60">
                              {VERDICT_DESC[ve.verdict]}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
