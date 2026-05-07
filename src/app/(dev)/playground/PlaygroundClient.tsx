"use client";

import { useState, useRef, useTransition } from "react";
import { CheckCircle2Icon, CircleDashedIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { CountryDropdown }                  from "@/components/custom/ui/country-dropdown";
import { CurrencyDropdown }                 from "@/components/custom/ui/currency-dropdown";
import { CurrencyBadge }                    from "@/components/custom/ui/currency-badge";
import { SelectDropdown }                   from "@/components/custom/ui/select-dropdown";
import { Button }                           from "@/components/ui/button";
import { MonthRangePicker, type DateRange } from "@/components/custom/ui/month-range-picker";
import { type FilterOptions }               from "@/lib/filter-options";
import { cn }                               from "@/lib/utils";
import { type SeriesHierarchy }             from "@/lib/series-hierarchy";
import { type EconomicDataPoint }           from "@/lib/coredata-db";
import { type Country }                     from "@/data/countries";
import { type SelectItem }                  from "@/components/custom/ui/select-dropdown";
import { loadSeries, type LoadedSeries }    from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeriesSelection {
  country  : string;
  classe   : string;
  type     : string;
  sourceCcy: string | undefined;
}

type CacheEntry = LoadedSeries;
type SeriesCache = Map<string, CacheEntry>;

function cacheKey(s: SeriesSelection) {
  return `${s.country}|${s.classe}|${s.type}|${s.sourceCcy ?? ""}`;
}

function filterByDates(data: EconomicDataPoint[], from: string, to: string): EconomicDataPoint[] {
  const f = from || null;
  const t = to   || null;
  return data.filter(d => {
    const dateStr = typeof d.date === "string" ? d.date : (d.date as Date).toISOString();
    return (!f || dateStr >= f) && (!t || dateStr <= t);
  });
}

// ─── SeriesFilterRow ──────────────────────────────────────────────────────────

interface RowProps {
  options   : FilterOptions;
  hierarchy : SeriesHierarchy;
  label     : string;
  onChange  : (selection: SeriesSelection | null) => void;
}

function SeriesFilterRow({ options, hierarchy, label, onChange }: RowProps) {
  const { countries, currencies } = options;

  const [country, setCountry] = useState<string | undefined>(undefined);
  const [classe,  setClasse ] = useState<string | undefined>(undefined);
  const [type,    setType   ] = useState<string | undefined>(undefined);

  const availableClasses = country ? Object.keys(hierarchy[country] ?? {}).sort() : [];
  const availableTypes   = country && classe ? Object.keys(hierarchy[country]?.[classe] ?? {}).sort() : [];
  const sourceCcy        = country && classe && type ? hierarchy[country]?.[classe]?.[type] : undefined;
  const isReady          = !!(country && classe && type);

  function handleCountryChange(c: Country) {
    setCountry(c.code); setClasse(undefined); setType(undefined);
    onChange(null);
  }

  function handleClasseChange(i: SelectItem) {
    setClasse(i.value); setType(undefined);
    onChange(null);
  }

  function handleTypeChange(i: SelectItem) {
    const newType = i.value;
    setType(newType);
    const newCcy = country && classe ? hierarchy[country]?.[classe]?.[newType] : undefined;
    onChange(country && classe ? { country, classe, type: newType, sourceCcy: newCcy } : null);
  }

  const ccyObj = sourceCcy ? currencies.find(c => c.code === sourceCcy) : undefined;

  return (
    <div className="rounded-lg border p-4 space-y-4">

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        {isReady
          ? <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium"><CheckCircle2Icon className="size-4" />Prête</span>
          : <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><CircleDashedIcon className="size-4" />Incomplète</span>
        }
      </div>

      <div className="flex flex-wrap gap-3">
        <CountryDropdown countries={countries} value={country} onChange={handleCountryChange} />
        <SelectDropdown
          items={availableClasses.map(c => ({ value: c, label: c }))}
          value={classe} onChange={handleClasseChange}
          placeholder={country ? "Classe" : "— classe —"}
          className={!country ? "opacity-40 pointer-events-none" : ""}
        />
        <SelectDropdown
          items={availableTypes.map(t => ({ value: t, label: t }))}
          value={type} onChange={handleTypeChange}
          placeholder={classe ? "Type" : "— type —"}
          className={!classe ? "opacity-40 pointer-events-none" : ""}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground min-h-8">
        <span>Devise source :</span>
        {isReady
          ? ccyObj
            ? <CurrencyBadge code={ccyObj.code} label={ccyObj.label} />
            : <span className="text-muted-foreground italic">Aucune devise associée</span>
          : <span className="text-muted-foreground italic">—</span>
        }
      </div>

    </div>
  );
}

// ─── PlaygroundClient ─────────────────────────────────────────────────────────

interface Props {
  options  : FilterOptions;
  hierarchy: SeriesHierarchy;
}

export function PlaygroundClient({ options, hierarchy }: Props) {
  const { currencies } = options;

  const [series1,    setSeries1   ] = useState<SeriesSelection | null>(null);
  const [series2,    setSeries2   ] = useState<SeriesSelection | null>(null);
  const [displayCcy, setDisplayCcy] = useState<string | undefined>(undefined);
  const [dateRange,  setDateRange ] = useState<DateRange | undefined>(undefined);

  const [loaded1, setLoaded1] = useState<LoadedSeries | null>(null);
  const [loaded2, setLoaded2] = useState<LoadedSeries | null>(null);

  const cache = useRef<SeriesCache>(new Map());
  const [isPending, startTransition] = useTransition();

  const bothReady = !!(series1 && series2);

  async function fetchSeries(sel: SeriesSelection): Promise<LoadedSeries | null> {
    const key = cacheKey(sel);
    if (cache.current.has(key)) return cache.current.get(key)!;

    const result = await loadSeries({ country: sel.country, class: sel.classe, type: sel.type, ccy: sel.sourceCcy });
    if ("error" in result) return null;

    cache.current.set(key, result);
    return result;
  }

  function handleCompare() {
    if (!bothReady) return;
    startTransition(async () => {
      const [r1, r2] = await Promise.all([fetchSeries(series1!), fetchSeries(series2!)]);
      setLoaded1(r1);
      setLoaded2(r2);
    });
  }

  const fromStr   = dateRange?.from ? dateRange.from.toISOString() : "";
  const toStr     = dateRange?.to   ? dateRange.to.toISOString()   : "";
  const filtered1 = loaded1 ? filterByDates(loaded1.data, fromStr, toStr) : [];
  const filtered2 = loaded2 ? filterByDates(loaded2.data, fromStr, toStr) : [];

  return (
    <div className="flex flex-col gap-4 w-fit">

      {/* Paramètres d'affichage */}
      <div className="rounded-lg border p-6 space-y-4">
        <p className="text-sm font-semibold">Paramètres d&apos;affichage</p>
        <div className="flex items-end justify-center gap-4">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Devise</p>
            <CurrencyDropdown
              currencies={currencies}
              value={displayCcy}
              onChange={(c) => setDisplayCcy(c.code)}
              placeholder="Sélectionner une devise cible"
            />
          </div>
          <MonthRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="icon"
            className={cn("size-9 self-end", dateRange ? "cursor-pointer" : "opacity-40 cursor-default")}
            onClick={() => setDateRange(undefined)}>
            <XIcon className="size-4" />
          </Button>
          <Button onClick={handleCompare} disabled={!bothReady || isPending}
            className={cn("h-9 w-36 self-end ml-4", bothReady && !isPending && "cursor-pointer")}>
            {isPending ? <><LoaderCircleIcon className="size-4 animate-spin mr-2" />Chargement...</> : "Comparer"}
          </Button>
        </div>
      </div>

      {/* Séries */}
      <div className="grid grid-cols-2 gap-4">
        <SeriesFilterRow options={options} hierarchy={hierarchy} label="Série 1" onChange={sel => { setSeries1(sel); setLoaded1(null); }} />
        <SeriesFilterRow options={options} hierarchy={hierarchy} label="Série 2" onChange={sel => { setSeries2(sel); setLoaded2(null); }} />
      </div>

      {/* Résultat temporaire — sera remplacé par le graphique */}
      {(loaded1 || loaded2) && (
        <div className="rounded-lg border p-4 space-y-3 text-sm">
          {loaded1 && <p><span className="font-semibold">Série 1 :</span> {loaded1.match.name} ({loaded1.match.code}) — <span className="font-mono">{filtered1.length}</span> points</p>}
          {loaded2 && <p><span className="font-semibold">Série 2 :</span> {loaded2.match.name} ({loaded2.match.code}) — <span className="font-mono">{filtered2.length}</span> points</p>}
        </div>
      )}

    </div>
  );
}