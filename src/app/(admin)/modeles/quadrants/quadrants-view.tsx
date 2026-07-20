"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  type QuadrantModelStatus,
} from "@/lib/coredata/four-quadrants";
import { useTransitionWidth } from "@/hooks/model-settings/transition-context";
import type {
  QuadrantModelConfig,
  QuadrantDataQuality,
  QuadrantPerfInput,
  QuadrantModelRow,
} from "@/lib/coredata/four-quadrants-service";
import { QuadrantsCountryView } from "./quadrants-country-view";
import { QuadrantsComparisonView } from "./quadrants-comparison-view";
import { QuadrantsVsEquityView } from "./quadrants-vs-equity-view";
import { QuadrantsMethodology, METHODOLOGY_SECTIONS } from "./quadrants-methodology";
import { ModelSettingsDialog } from "@/components/custom/model-settings/settings-dialog";
import {
  ModelStickyControls,
  type StickyNavSection,
  type StickySummaryItem,
} from "@/components/custom/model-shell/model-sticky-controls";
import { loadCountryQuadrantModel, loadQuadrantComparison } from "./actions";
import { REGION_ITEMS, type PerfMode, type QuadrantRegion } from "./helpers";
import { availabilityMessage, type AvailabilityReason } from "./availability-message";

// Statut de modèle non-OK → cause d'indisponibilité (message homogène, cf. helper).
const MODEL_REASON: Record<Exclude<QuadrantModelStatus, "OK">, AvailabilityReason> = {
  MISSING_SERIES: "missing_series",
  INVALID_VALUE: "invalid_value",
  INSUFFICIENT_HISTORY: "insufficient_history",
};

type Tab = "country" | "comparison" | "vs_actions" | "methodology";
type Period = "MAX" | "20A" | "10A" | "5A";

const TABS: { key: Tab; label: string; icon: typeof LineChart; ready: boolean }[] = [
  { key: "country", label: "Vue pays", icon: LineChart, ready: true },
  { key: "comparison", label: "Comparaison pays", icon: Table2, ready: true },
  { key: "vs_actions", label: "4 Quadrants vs Actions", icon: Swords, ready: true },
  { key: "methodology", label: "Méthodologie", icon: BookOpen, ready: true },
];

// Navigation interne par onglet.
const SECTIONS: Record<Tab, StickyNavSection[]> = {
  country: [
    { id: "resume", label: "Résumé" },
    { id: "indicateurs", label: "Indicateurs" },
    { id: "performance", label: "Performance" },
    { id: "drawdown", label: "Drawdown" },
    { id: "composition", label: "Composition" },
    { id: "sources-qualite", label: "Sources & qualité" },
  ],
  comparison: [
    { id: "positionnement", label: "Positionnement" },
    { id: "tableau", label: "Tableau" },
  ],
  vs_actions: [
    { id: "synthese", label: "Synthèse" },
    { id: "compromis", label: "Compromis" },
    { id: "detail", label: "Détail" },
    { id: "regularite", label: "Régularité" },
    { id: "comparateur", label: "Comparateur" },
    { id: "carte", label: "Carte" },
  ],
  methodology: METHODOLOGY_SECTIONS,
};

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
  { value: "nominal_vs_inflation", label: "Nominal vs Inflation" },
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
  const [region, setRegion] = useState<QuadrantRegion>("monde");
  const [tab, setTab] = useState<Tab>("country");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Comparaison pays (calcul serveur) — snapshot + métriques uniquement.
  const [comparison, setComparison] = useState<QuadrantModelRow[] | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

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
            ...perf,
            windowYears: PERIOD_YEARS[period],
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

  // Comparaison + vs Actions : recalcul SERVEUR au changement de stratégie / zone
  // neutre (settings) ou de période. Le mode et la région restent client-side
  // (la ligne porte déjà toutes les métriques + écarts + heatmap). Batch PARTAGÉ :
  // `needsBatch` (booléen) → pas de rechargement en basculant entre les 2 onglets.
  const needsBatch = tab === "comparison" || tab === "vs_actions";
  useEffect(() => {
    if (!needsBatch) return;
    let ignore = false;
    setComparisonLoading(true);
    loadQuadrantComparison(settings, PERIOD_YEARS[period])
      .then((rows) => {
        if (!ignore) setComparison(rows);
      })
      .finally(() => {
        if (!ignore) setComparisonLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [needsBatch, settings, period]);

  // Depuis la comparaison → Vue pays : conserve stratégie / T / période / mode (état).
  function onPickCountry(iso: string) {
    setTab("country");
    onCountry(iso);
  }

  const countryItems: SelectItem[] = countries.map((c) => ({
    value: c.iso,
    label: c.nameFr,
    icon: <CountryFlag code={c.iso} countryName={c.nameFr} size={18} />,
  }));

  // Onglets orientés « groupe de pays » (filtre région, calcul serveur partagé).
  const isRegionTab = tab === "comparison" || tab === "vs_actions";

  // Contrôles complets (bloc initial + panneau « Modifier ») — 1er champ contextuel.
  const renderControls = () => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {isRegionTab ? (
        <Control label="Région">
          <SelectDropdown
            items={REGION_ITEMS}
            value={region}
            onChange={(i) => setRegion(i.value as QuadrantRegion)}
            width="w-full"
          />
        </Control>
      ) : (
        <Control label="Pays">
          <SelectDropdown
            items={countryItems}
            value={country}
            onChange={(i) => onCountry(i.value)}
            width="w-full"
          />
        </Control>
      )}
      <Control label="Période">
        <SelectDropdown
          items={PERIOD_ITEMS}
          value={period}
          onChange={(i) => setPeriod(i.value as Period)}
          width="w-full"
        />
      </Control>
      <Control label="Devise d’analyse">
        <SelectDropdown items={DEVISE_ITEMS} value="local" width="w-full" />
      </Control>
      <Control label="Mode d’analyse">
        <SelectDropdown
          items={MODE_ITEMS}
          value={perfMode}
          onChange={(i) => setPerfMode(i.value as PerfMode)}
          width="w-full"
        />
      </Control>
      <Control label="Stratégie">
        <SelectDropdown
          items={STRATEGY_ITEMS}
          value={strategy}
          onChange={(i) => setStrategy(i.value as Strategy)}
          width="w-full"
        />
      </Control>
    </div>
  );

  // Résumé compact des valeurs actives (barre condensée).
  const summary: StickySummaryItem[] = [
    isRegionTab
      ? { label: "Région", value: REGION_ITEMS.find((i) => i.value === region)?.label ?? region }
      : { label: "Pays", value: countries.find((c) => c.iso === country)?.nameFr ?? country },
    { label: "Période", value: PERIOD_ITEMS.find((i) => i.value === period)?.label ?? period },
    { label: "Devise", value: "Locale" },
    { label: "Mode", value: MODE_ITEMS.find((i) => i.value === perfMode)?.label ?? perfMode },
    {
      label: "Stratégie",
      value: STRATEGY_ITEMS.find((i) => i.value === strategy)?.label ?? strategy,
    },
  ];

  const reglagesButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setSettingsOpen(true)}
      className="mb-1 ml-auto w-28 shrink-0 cursor-pointer gap-1.5"
    >
      <SlidersHorizontal className="size-3.5" />
      Réglages
    </Button>
  );

  return (
    <>
      <ModelStickyControls
        tabs={TABS}
        activeTab={tab}
        onTabChange={(k) => setTab(k as Tab)}
        headerExtra={reglagesButton}
        showParams={tab !== "methodology"}
        renderControls={renderControls}
        summary={summary}
        sections={SECTIONS[tab]}
        loading={pending}
      >
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
                {model && model.status !== "OK"
                  ? availabilityMessage(MODEL_REASON[model.status])
                  : "Données insuffisantes pour ce pays."}
              </Card>
            )}
          </div>
        ) : tab === "comparison" ? (
          <QuadrantsComparisonView
            rows={comparison}
            loading={comparisonLoading}
            onPick={onPickCountry}
            displayMode={perfMode}
            region={region}
            years={PERIOD_YEARS[period]}
          />
        ) : tab === "vs_actions" ? (
          <QuadrantsVsEquityView
            rows={comparison}
            loading={comparisonLoading}
            onPick={onPickCountry}
            region={region}
            settings={settings}
            years={PERIOD_YEARS[period]}
          />
        ) : (
          <QuadrantsMethodology />
        )}
      </ModelStickyControls>

      <ModelSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
