"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { LineChart, Table2, Swords, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Card } from "@/components/ui/card";
import { SelectDropdown, type SelectItem } from "@/components/custom/ui/select-dropdown";
import {
  computeBrowne,
  REBALANCE_LABELS,
  type RebalanceFrequency,
  type BrowneResult,
  type ComputeBrowneInput,
} from "@/lib/coredata/browne";
import type {
  CountryBrowneConfig,
  BrowneDataQuality,
  BrowneComparisonRow,
} from "@/lib/coredata/browne-service";
import { BrowneCountryView } from "./browne-country-view";
import { BrowneComparisonView } from "./browne-comparison-view";
import { BrowneVsEquityView } from "./browne-vs-equity-view";
import { BrowneMethodology, METHODOLOGY_SECTIONS } from "./browne-methodology";
import { loadCountryBrowne, loadBrowneComparison } from "./actions";
import {
  ModelStickyControls,
  type StickyNavSection,
  type StickySummaryItem,
} from "@/components/custom/model-shell/model-sticky-controls";
import {
  filterInput,
  PERIOD_ITEMS,
  DISPLAY_ITEMS,
  BROWNE_REGION_ITEMS,
  type BrownePeriod,
  type BrowneDisplayMode,
  type BrowneRegion,
} from "./helpers";

/** Preset de période → nombre d'années (null = MAX). */
const PERIOD_YEARS: Record<BrownePeriod, number | null> = {
  MAX: null,
  "20A": 20,
  "10A": 10,
  "5A": 5,
};

type Tab = "country" | "comparison" | "vs_equity" | "methodology";

const TABS: { key: Tab; label: string; icon: typeof LineChart; ready: boolean }[] = [
  { key: "country", label: "Vue pays", icon: LineChart, ready: true },
  { key: "comparison", label: "Comparaison pays", icon: Table2, ready: true },
  { key: "vs_equity", label: "Browne vs Actions", icon: Swords, ready: true },
  { key: "methodology", label: "Méthodologie", icon: BookOpen, ready: true },
];

// Sections de navigation interne par onglet (ancres construites depuis les
// sections réellement présentes dans chaque vue).
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
  vs_equity: [
    { id: "synthese", label: "Synthèse" },
    { id: "compromis", label: "Compromis" },
    { id: "detail", label: "Détail" },
    { id: "regularite", label: "Régularité" },
    { id: "comparateur", label: "Comparateur" },
    { id: "carte", label: "Carte" },
  ],
  methodology: METHODOLOGY_SECTIONS,
};

const REBALANCE_ITEMS: SelectItem[] = (
  ["monthly", "quarterly", "annual", "none"] as RebalanceFrequency[]
).map((v) => ({ value: v, label: REBALANCE_LABELS[v] }));

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function BrowneView({
  countries,
  defaultCountry,
  initial,
}: {
  countries: { iso: string; nameFr: string }[];
  defaultCountry: string;
  initial: {
    config: CountryBrowneConfig | null;
    dataQuality: BrowneDataQuality;
    input: ComputeBrowneInput | null;
  };
}) {
  const [country, setCountry] = useState(defaultCountry);
  const [config, setConfig] = useState(initial.config);
  const [input, setInput] = useState(initial.input);
  const [dataQuality, setDataQuality] = useState(initial.dataQuality);
  const [rebalance, setRebalance] = useState<RebalanceFrequency>("annual");
  const [displayMode, setDisplayMode] = useState<BrowneDisplayMode>("real");
  const [period, setPeriod] = useState<BrownePeriod>("MAX");
  const [region, setRegion] = useState<BrowneRegion>("monde");
  const [tab, setTab] = useState<Tab>("country");
  const [pending, startTransition] = useTransition();

  // Comparaison pays (calcul serveur) — chargée à l'ouverture de l'onglet et à
  // chaque changement de période/rééquilibrage, sous les mêmes paramètres.
  const [comparison, setComparison] = useState<BrowneComparisonRow[] | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const result = useMemo<BrowneResult | null>(() => {
    if (!input) return null;
    return computeBrowne({ ...filterInput(input, period), rebalance });
  }, [input, rebalance, period]);

  function onCountry(iso: string) {
    setCountry(iso);
    startTransition(async () => {
      const p = await loadCountryBrowne(iso);
      setConfig(p.config);
      setInput(p.input);
      setDataQuality(p.dataQuality);
    });
  }

  useEffect(() => {
    if (tab !== "comparison" && tab !== "vs_equity") return;
    let ignore = false;
    setComparisonLoading(true);
    loadBrowneComparison(rebalance, PERIOD_YEARS[period])
      .then((rows) => {
        if (!ignore) setComparison(rows);
      })
      .finally(() => {
        if (!ignore) setComparisonLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [tab, rebalance, period]);

  function onPickCountry(iso: string) {
    setTab("country");
    onCountry(iso);
  }

  const countryItems: SelectItem[] = countries.map((c) => ({
    value: c.iso,
    label: c.nameFr,
    icon: <CountryFlag code={c.iso} countryName={c.nameFr} size={18} />,
  }));

  const isRegionTab = tab === "comparison" || tab === "vs_equity";

  // Contrôles complets (bloc initial + panneau « Modifier »).
  const renderControls = () => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {isRegionTab ? (
        <Control label="Région">
          <SelectDropdown
            items={BROWNE_REGION_ITEMS}
            value={region}
            onChange={(i) => setRegion(i.value as BrowneRegion)}
            width="w-full"
          />
        </Control>
      ) : (
        <Control label="Pays">
          <SelectDropdown items={countryItems} value={country} onChange={(i) => onCountry(i.value)} width="w-full" />
        </Control>
      )}
      <Control label="Période">
        <SelectDropdown items={PERIOD_ITEMS} value={period} onChange={(i) => setPeriod(i.value as BrownePeriod)} width="w-full" />
      </Control>
      <Control label="Devise d’analyse">
        <SelectDropdown items={[{ value: "local", label: "Locale" }]} value="local" width="w-full" />
      </Control>
      <Control label="Mode d’analyse">
        <SelectDropdown
          items={DISPLAY_ITEMS}
          value={displayMode}
          onChange={(i) => setDisplayMode(i.value as BrowneDisplayMode)}
          width="w-full"
        />
      </Control>
      <Control label="Rééquilibrage">
        <SelectDropdown
          items={REBALANCE_ITEMS}
          value={rebalance}
          onChange={(i) => setRebalance(i.value as RebalanceFrequency)}
          width="w-full"
        />
      </Control>
    </div>
  );

  // Résumé compact des valeurs actives (barre condensée).
  const summary: StickySummaryItem[] = [
    isRegionTab
      ? { label: "Région", value: BROWNE_REGION_ITEMS.find((i) => i.value === region)?.label ?? region }
      : { label: "Pays", value: countries.find((c) => c.iso === country)?.nameFr ?? country },
    { label: "Période", value: PERIOD_ITEMS.find((i) => i.value === period)?.label ?? period },
    { label: "Devise", value: "Locale" },
    { label: "Mode", value: DISPLAY_ITEMS.find((i) => i.value === displayMode)?.label ?? displayMode },
    { label: "Rééquilibrage", value: REBALANCE_LABELS[rebalance] },
  ];

  return (
    <ModelStickyControls
      tabs={TABS}
      activeTab={tab}
      onTabChange={(k) => setTab(k as Tab)}
      showParams={tab !== "methodology"}
      renderControls={renderControls}
      summary={summary}
      sections={SECTIONS[tab]}
      loading={pending || comparisonLoading}
    >
      {/* Contenu */}
      {tab === "country" ? (
        <div className={cn(pending && "pointer-events-none opacity-60 transition-opacity")}>
          {config && result ? (
            <BrowneCountryView
              config={config}
              dataQuality={dataQuality}
              result={result}
              displayMode={displayMode}
            />
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Aucune donnée disponible pour ce pays.
            </Card>
          )}
        </div>
      ) : tab === "comparison" ? (
        <BrowneComparisonView
          rows={comparison}
          loading={comparisonLoading}
          onPick={onPickCountry}
          displayMode={displayMode}
          region={region}
        />
      ) : tab === "vs_equity" ? (
        <BrowneVsEquityView
          rows={comparison}
          loading={comparisonLoading}
          onPick={onPickCountry}
          region={region}
          rebalance={rebalance}
          periodYears={PERIOD_YEARS[period]}
        />
      ) : tab === "methodology" ? (
        <BrowneMethodology />
      ) : (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Onglet « {TABS.find((t) => t.key === tab)?.label} » — bientôt disponible.
        </Card>
      )}
    </ModelStickyControls>
  );
}
