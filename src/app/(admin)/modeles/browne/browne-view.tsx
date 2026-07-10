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
import { loadCountryBrowne, loadBrowneComparison } from "./actions";
import {
  filterInput,
  PERIOD_ITEMS,
  DISPLAY_ITEMS,
  type BrownePeriod,
  type BrowneDisplayMode,
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
  { key: "vs_equity", label: "Browne vs Actions", icon: Swords, ready: false },
  { key: "methodology", label: "Méthodologie", icon: BookOpen, ready: false },
];

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
    if (tab !== "comparison") return;
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

  return (
    <div className="space-y-4">
      {/* Barre de paramètres globale */}
      <Card className="p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Control label="Pays">
            <SelectDropdown items={countryItems} value={country} onChange={(i) => onCountry(i.value)} width="w-full" />
          </Control>
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
      </Card>

      {/* Onglets */}
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
            {!t.ready && (
              <span className="rounded-full border border-border px-1 text-[10px] leading-none uppercase">
                bientôt
              </span>
            )}
          </button>
        ))}
      </div>

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
        <BrowneComparisonView rows={comparison} loading={comparisonLoading} onPick={onPickCountry} />
      ) : (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Onglet « {TABS.find((t) => t.key === tab)?.label} » — bientôt disponible.
        </Card>
      )}
    </div>
  );
}
