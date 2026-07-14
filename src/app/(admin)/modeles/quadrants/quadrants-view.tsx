"use client";

import { useMemo, useState, useTransition } from "react";
import { LineChart, Table2, Swords, BookOpen, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectDropdown, type SelectItem } from "@/components/custom/ui/select-dropdown";
import {
  buildModel,
  backtestQuadrants,
  weightsFromModel,
  DEFAULT_FOUR_QUADRANTS_SETTINGS,
  type BuildModelInput,
  type FourQuadrantsModelSettings,
  type Strategy,
} from "@/lib/coredata/four-quadrants";
import { useTransitionWidth } from "@/hooks/model-settings/transition-context";
import type {
  QuadrantModelConfig,
  QuadrantDataQuality,
  QuadrantPerfInput,
} from "@/lib/coredata/four-quadrants-service";
import { QuadrantsCountryView } from "./quadrants-country-view";
import { ModelSettingsDialog } from "@/components/custom/model-settings/settings-dialog";
import { loadCountryQuadrantModel } from "./actions";
import type { PerfMode } from "./helpers";

type Tab = "country" | "comparison" | "vs_browne" | "methodology";
type Period = "MAX" | "20A" | "10A" | "5A";

const TABS: { key: Tab; label: string; icon: typeof LineChart; ready: boolean }[] = [
  { key: "country", label: "Vue pays", icon: LineChart, ready: true },
  { key: "comparison", label: "Comparaison pays", icon: Table2, ready: false },
  { key: "vs_browne", label: "4 Quadrants vs Browne", icon: Swords, ready: false },
  { key: "methodology", label: "Méthodologie", icon: BookOpen, ready: false },
];

const PERIOD_ITEMS: SelectItem[] = [
  { value: "MAX", label: "Max" },
  { value: "20A", label: "20 ans" },
  { value: "10A", label: "10 ans" },
  { value: "5A", label: "5 ans" },
];
const PERIOD_YEARS: Record<Period, number | null> = { MAX: null, "20A": 20, "10A": 10, "5A": 5 };
const DEVISE_ITEMS: SelectItem[] = [{ value: "local", label: "Locale" }];
const MODE_ITEMS: SelectItem[] = [
  { value: "nominal", label: "Nominal" },
  { value: "real", label: "Réel" },
];
const STRATEGY_ITEMS: SelectItem[] = [
  { value: "binary", label: "Binaire" },
  { value: "dynamic", label: "Dynamique" },
];

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Décale une date `YYYY-MM-DD` de `delta` années (comparaison lexicographique). */
function shiftYears(date: string, delta: number): string {
  return `${Number(date.slice(0, 4)) + delta}${date.slice(4)}`;
}

/** Restreint les séries de perf aux `years` dernières années (null = MAX). */
function clipPerf(perf: QuadrantPerfInput, years: number | null): QuadrantPerfInput {
  if (years === null) return perf;
  const last = perf.equityTotalReturn.at(-1)?.date;
  if (!last) return perf;
  const cutoff = shiftYears(last, -years);
  const f = (s: QuadrantPerfInput["gold"]) => s.filter((p) => p.date >= cutoff);
  return {
    equityTotalReturn: f(perf.equityTotalReturn),
    bondTotalReturn: f(perf.bondTotalReturn),
    cashTotalReturn: f(perf.cashTotalReturn),
    gold: f(perf.gold),
    cpi: perf.cpi ? f(perf.cpi) : undefined,
  };
}

function Placeholder({ label }: { label: string }) {
  return (
    <Card className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">Bientôt disponible.</span>
    </Card>
  );
}

export function QuadrantsView({
  countries,
  defaultCountry,
  initial,
}: {
  countries: { iso: string; nameFr: string }[];
  defaultCountry: string;
  initial: {
    config: QuadrantModelConfig | null;
    dataQuality: QuadrantDataQuality;
    signal: BuildModelInput | null;
    perf: QuadrantPerfInput | null;
  };
}) {
  const [country, setCountry] = useState(defaultCountry);
  const [config, setConfig] = useState(initial.config);
  const [signal, setSignal] = useState(initial.signal);
  const [perf, setPerf] = useState(initial.perf);
  const [dataQuality, setDataQuality] = useState(initial.dataQuality);

  const [strategy, setStrategy] = useState<Strategy>("dynamic");
  const { transitionWidth } = useTransitionWidth(); // persistant + partagé (réglé via Réglages)
  const [perfMode, setPerfMode] = useState<PerfMode>("real");
  const [period, setPeriod] = useState<Period>("MAX");
  const [tab, setTab] = useState<Tab>("country");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const settings = useMemo<FourQuadrantsModelSettings>(
    () => ({ ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth }),
    [strategy, transitionWidth],
  );

  // Recalcul CLIENT-SIDE : le moteur pur tourne dans le navigateur, instantané au
  // changement de stratégie / largeur de transition / période (aucun aller-retour serveur).
  const model = useMemo(() => (signal ? buildModel(signal, settings) : null), [signal, settings]);
  const backtest = useMemo(
    () =>
      model && model.status === "OK" && perf
        ? backtestQuadrants({
            countryCode: country,
            weights: weightsFromModel(model),
            ...clipPerf(perf, PERIOD_YEARS[period]),
          })
        : null,
    [model, perf, country, period],
  );

  function onCountry(iso: string) {
    setCountry(iso);
    startTransition(async () => {
      const p = await loadCountryQuadrantModel(iso);
      setConfig(p.config);
      setSignal(p.signal);
      setPerf(p.perf);
      setDataQuality(p.dataQuality);
    });
  }

  const countryItems: SelectItem[] = countries.map((c) => ({
    value: c.iso,
    label: c.nameFr,
    icon: <CountryFlag code={c.iso} countryName={c.nameFr} size={18} />,
  }));

  return (
    <div className="space-y-4">
      {/* Onglets — même logique que Browne, + accès aux réglages généraux */}
      <div className="sticky top-0 z-20 -mx-6 bg-background/85 px-6 backdrop-blur-sm">
        <nav className="flex flex-wrap items-center gap-1 border-b border-border/60">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative -mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className={cn("size-4", active ? "text-primary" : "opacity-70")} />
                {t.label}
                {!t.ready && (
                  <span className="ml-0.5 rounded bg-muted px-1 py-px text-[9px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                    bientôt
                  </span>
                )}
              </button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="mb-1 ml-auto w-28 shrink-0 cursor-pointer gap-1.5"
          >
            <SlidersHorizontal className="size-3.5" />
            Réglages
          </Button>
        </nav>
      </div>

      {/* Barre de paramètres — clone Browne (Rééquilibrage → Stratégie) */}
      {tab !== "methodology" && (
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Control label="Pays">
              <SelectDropdown items={countryItems} value={country} onChange={(i) => onCountry(i.value)} width="w-full" />
            </Control>
            <Control label="Période">
              <SelectDropdown items={PERIOD_ITEMS} value={period} onChange={(i) => setPeriod(i.value as Period)} width="w-full" />
            </Control>
            <Control label="Devise d’analyse">
              <SelectDropdown items={DEVISE_ITEMS} value="local" width="w-full" />
            </Control>
            <Control label="Mode d’analyse">
              <SelectDropdown items={MODE_ITEMS} value={perfMode} onChange={(i) => setPerfMode(i.value as PerfMode)} width="w-full" />
            </Control>
            <Control label="Stratégie">
              <SelectDropdown items={STRATEGY_ITEMS} value={strategy} onChange={(i) => setStrategy(i.value as Strategy)} width="w-full" />
            </Control>
          </div>
        </Card>
      )}

      {tab === "country" ? (
        <div className={cn(pending && "pointer-events-none opacity-60 transition-opacity")}>
          {config && model && model.status === "OK" ? (
            <QuadrantsCountryView
              config={config}
              dataQuality={dataQuality}
              model={model}
              backtest={backtest}
              strategy={strategy}
              transitionWidth={transitionWidth}
              displayMode={perfMode}
            />
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Données insuffisantes pour ce pays.
            </Card>
          )}
        </div>
      ) : tab === "comparison" ? (
        <Placeholder label="Comparaison pays" />
      ) : tab === "vs_browne" ? (
        <Placeholder label="4 Quadrants vs Browne" />
      ) : (
        <Placeholder label="Méthodologie" />
      )}

      <ModelSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
