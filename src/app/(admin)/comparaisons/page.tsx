import { getSeriesData, type EconomicDataPoint } from "@/lib/coredata";
import { ratioSeries, movingAverage, computeKpis } from "@/lib/coredata/compute";
import { MACRO_SIGNALS, TRANSITION_ECONOMIC } from "./signals";
import { classifySignal } from "./signal-classify";
import { SignalsGrid, type SignalView } from "./signals-grid";
import { readRegime, type AxisInput } from "./regime-reading";
import { SynthesisCard } from "./synthesis-card";
import type { ChartPoint } from "../exploration/exploration-chart";

// Page Comparaisons / Signaux macro. Chaque signal est un ratio canonique
// (Gave/Darcet) classé avec une bande de neutralité (zone de transition). Une
// carte de synthèse agrège les deux axes (énergie × devise) en une lecture de
// régime, avec niveau de confiance.
export default async function ComparaisonsPage() {
  const ids = [...new Set(MACRO_SIGNALS.flatMap((s) => [s.numerator, s.denominator]))];
  const data = new Map<string, EconomicDataPoint[]>();
  await Promise.all(ids.map(async (id) => data.set(id, await getSeriesData(id))));

  const computed = MACRO_SIGNALS.map((s) => {
    const ratio = ratioSeries(data.get(s.numerator) ?? [], data.get(s.denominator) ?? []);
    const ma = movingAverage(ratio, s.maYears * 12);
    const maByDate = new Map(ma.map((p) => [p.date, p.value]));
    const chartData: ChartPoint[] = ratio.map((p) => ({
      date: p.date,
      ratio: p.value,
      ma: maByDate.get(p.date),
    }));
    const cls = classifySignal(ratio, ma, s.threshold);
    const lastValue = ratio.length ? ratio[ratio.length - 1].value : null;
    return { signal: s, chartData, lastValue, cls, kpis: computeKpis(ratio) };
  });

  const byId = new Map(computed.map((c) => [c.signal.id, c.cls]));
  const axis = (id: string): AxisInput => {
    const cls = byId.get(id);
    return { displayState: cls?.displayState ?? null, confirmedDir: cls?.confirmedDir ?? null };
  };
  const reading = readRegime(axis("spx-wti"), axis("ust10-gold"), byId.get("spx-gold")?.displayState ?? null);

  const views: SignalView[] = computed.map((c) => {
    const ds = c.cls.displayState;
    const economic =
      ds === "positive"
        ? c.signal.economic.positive
        : ds === "negative"
          ? c.signal.economic.negative
          : TRANSITION_ECONOMIC;
    return {
      id: c.signal.id,
      title: c.signal.title,
      meaning: c.signal.meaning,
      tooltip: c.signal.tooltip,
      valueNote: c.signal.valueNote,
      maYears: c.signal.maYears,
      chartData: c.chartData,
      lastValue: c.lastValue,
      economic,
      technicalState: c.cls.technicalState,
      displayState: ds,
      ecart: c.cls.ecart,
      kpis: c.kpis,
      phrase: ds ? c.signal.interpretation[ds] : "",
      exploreHref: `/exploration?a=${encodeURIComponent(c.signal.numerator)}&b=${encodeURIComponent(
        c.signal.denominator,
      )}&op=ratio`,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Signaux macro</h1>
        <p className="text-sm text-muted-foreground">
          Les grands ratios qui éclairent le régime économique, et ce qu’ils disent aujourd’hui.
        </p>
      </header>
      <SynthesisCard reading={reading} />
      <SignalsGrid views={views} />
    </div>
  );
}
