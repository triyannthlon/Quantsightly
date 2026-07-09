"use client";

import { useMemo, useState, useTransition } from "react";
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
import type { CountryBrowneConfig, BrowneDataQuality } from "@/lib/coredata/browne-service";
import { BrowneCountryView } from "./browne-country-view";
import { loadCountryBrowne } from "./actions";
import {
  filterInput,
  PERIOD_ITEMS,
  DISPLAY_ITEMS,
  type BrownePeriod,
  type BrowneDisplayMode,
} from "./helpers";

type Tab = "country" | "comparison" | "vs_equity" | "methodology";

const TABS: { key: Tab; label: string; icon: typeof LineChart; ready: boolean }[] = [
  { key: "country", label: "Vue pays", icon: LineChart, ready: true },
  { key: "comparison", label: "Comparaison pays", icon: Table2, ready: false },
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

  const countryItems: SelectItem[] = countries.map((c) => ({
    value: c.iso,
    label: c.nameFr,
    icon: <CountryFlag code={c.iso} countryName={c.nameFr} size={18} />,
  }));

  return (
    <div className="space-y-4">
      {/* Barre de paramètres globale */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Control label="Pays">
            <SelectDropdown items={countryItems} value={country} onChange={(i) => onCountry(i.value)} width="w-52" />
          </Control>
          <Control label="Période">
            <SelectDropdown items={PERIOD_ITEMS} value={period} onChange={(i) => setPeriod(i.value as BrownePeriod)} width="w-32" />
          </Control>
          <Control label="Devise d’analyse">
            <SelectDropdown items={[{ value: "local", label: "Locale" }]} value="local" width="w-32" />
          </Control>
          <Control label="Affichage">
            <SelectDropdown
              items={DISPLAY_ITEMS}
              value={displayMode}
              onChange={(i) => setDisplayMode(i.value as BrowneDisplayMode)}
              width="w-48"
            />
          </Control>
          <Control label="Rééquilibrage">
            <SelectDropdown
              items={REBALANCE_ITEMS}
              value={rebalance}
              onChange={(i) => setRebalance(i.value as RebalanceFrequency)}
              width="w-36"
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
      ) : (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Onglet « {TABS.find((t) => t.key === tab)?.label} » — bientôt disponible.
        </Card>
      )}
    </div>
  );
}
