"use client";

import {
  useState,
  useRef,
  useTransition,
  useCallback,
  useSyncExternalStore,
  useEffect,
} from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react";
import { CountryDropdown } from "@/components/custom/ui/country-dropdown";
import { CurrencyDropdown } from "@/components/custom/ui/currency-dropdown";
import { CurrencyBadge } from "@/components/custom/ui/currency-badge";
import { SelectDropdown } from "@/components/custom/ui/select-dropdown";
import { Button } from "@/components/ui/button";
import { MonthRangePicker, type DateRange } from "@/components/custom/ui/month-range-picker";
import { type FilterOptions } from "@/lib/filter-options";
import { cn } from "@/lib/utils";
import { type SeriesHierarchy } from "@/lib/series-hierarchy";
import { type EconomicDataPoint } from "@/lib/coredata-db";
import { type Country } from "@/data/countries";
import { type SelectItem } from "@/components/custom/ui/select-dropdown";
import { loadSeries, type LoadedSeries } from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SeriesTransform = "defaut" | "ratio" | "mm7";

export interface SeriesSelection {
  country: string;
  classe: string;
  type: string;
  sourceCcy: string | undefined;
  transform: SeriesTransform;
}

const TRANSFORM_ITEMS: SelectItem[] = [
  { value: "defaut", label: "Défaut" },
  { value: "ratio", label: "Ratio" },
  { value: "mm7", label: "Moyenne mobile 7 mois" },
];

type CacheEntry = LoadedSeries;
type SeriesCache = Map<string, CacheEntry>;

function cacheKey(s: SeriesSelection) {
  return `${s.country}|${s.classe}|${s.type}|${s.sourceCcy ?? ""}|${s.transform}`;
}

function filterByDates(data: EconomicDataPoint[], from: string, to: string): EconomicDataPoint[] {
  const f = from || null;
  const t = to || null;
  return data.filter((d) => {
    const dateStr = typeof d.date === "string" ? d.date : (d.date as Date).toISOString();
    return (!f || dateStr >= f) && (!t || dateStr <= t);
  });
}

// ─── localStorage + useSyncExternalStore ─────────────────────────────────────
//
// useSyncExternalStore est la solution React recommandée pour lire un store
// externe (ici localStorage) sans appeler setState dans un effet.
// Le troisième argument (getServerSnapshot) retourne la valeur par défaut côté
// serveur, ce qui évite les erreurs d'hydratation.

// Cache de références stables : évite que JSON.parse crée un nouvel objet à
// chaque appel, ce qui provoquerait une boucle de re-renders dans useSyncExternalStore.
const _lsCache = new Map<string, { raw: string; value: unknown }>();

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const cached = _lsCache.get(key);
    if (cached?.raw === raw) return cached.value as T;
    const value = JSON.parse(raw) as T;
    _lsCache.set(key, { raw, value });
    return value;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  try {
    const raw = JSON.stringify(value);
    _lsCache.set(key, { raw, value });
    localStorage.setItem(key, raw);
  } catch {
    /* quota exceeded */
  }
}

const noopSubscribe = () => () => {};

function useLsState<T>(key: string, fallback: T): [T, (v: T) => void] {
  // Après hydratation, useSyncExternalStore lit localStorage (client snapshot).
  // Pendant le SSR et l'hydratation, il utilise fallback (server snapshot).
  const fromLs = useSyncExternalStore(
    noopSubscribe,
    () => lsGet(key, fallback),
    () => fallback,
  );

  // Après le premier appel à set(), on utilise la valeur en mémoire plutôt que
  // de relire localStorage (noopSubscribe ne déclenche pas de re-render automatique).
  const [mem, setMem] = useState<{ value: T; active: boolean }>({ value: fallback, active: false });

  const set = useCallback(
    (newValue: T) => {
      lsSet(key, newValue);
      setMem({ value: newValue, active: true });
    },
    [key],
  );

  return [mem.active ? mem.value : fromLs, set];
}

// ─── Couleurs de série ────────────────────────────────────────────────────────

export interface SeriesColor {
  hex: string;
  badgeClassName: string;
}

export const SERIE_COLORS: Record<"s1" | "s2", SeriesColor> = {
  s1: {
    hex: "#502239",
    badgeClassName:
      "bg-[rgba(80,34,57,0.10)] border-[rgba(80,34,57,0.25)] text-[#502239] dark:bg-[rgba(80,34,57,0.20)] dark:border-[rgba(80,34,57,0.45)] dark:text-[#CE8DAD]",
  },
  s2: {
    hex: "#2E4A6B",
    badgeClassName:
      "bg-[rgba(46,74,107,0.10)] border-[rgba(46,74,107,0.25)] text-[#2E4A6B] dark:bg-[rgba(46,74,107,0.20)] dark:border-[rgba(46,74,107,0.45)] dark:text-[#94B0D1]",
  },
};

// ─── SeriesFilterRow ──────────────────────────────────────────────────────────

interface RowProps {
  options: FilterOptions;
  hierarchy: SeriesHierarchy;
  label: string;
  color?: SeriesColor;
  error: string | null;
  initialSelection?: SeriesSelection | null;
  onChange: (selection: SeriesSelection | null) => void;
}

// Le composant est monté avec une `key` qui change quand initialSelection arrive,
// donc useState() s'initialise correctement sans avoir besoin d'un effet.
function SeriesFilterRow({
  options,
  hierarchy,
  label,
  color,
  error,
  initialSelection,
  onChange,
}: RowProps) {
  const { countries, currencies } = options;

  const [country, setCountry] = useState<string | undefined>(initialSelection?.country);
  const [classe, setClasse] = useState<string | undefined>(initialSelection?.classe);
  const [type, setType] = useState<string | undefined>(initialSelection?.type);
  const [transform, setTransform] = useState<SeriesTransform>(
    initialSelection?.transform ?? "defaut",
  );

  const availableClasses = country ? Object.keys(hierarchy[country] ?? {}).sort() : [];
  const availableTypes =
    country && classe ? Object.keys(hierarchy[country]?.[classe] ?? {}).sort() : [];
  const sourceCcy = country && classe && type ? hierarchy[country]?.[classe]?.[type] : undefined;
  const isReady = !!(country && classe && type);

  function handleCountryChange(c: Country) {
    setCountry(c.code);
    setClasse(undefined);
    setType(undefined);
    onChange(null);
  }

  function handleClasseChange(i: SelectItem) {
    setClasse(i.value);
    setType(undefined);
    onChange(null);
  }

  function handleTypeChange(i: SelectItem) {
    const newType = i.value;
    setType(newType);
    const newCcy = country && classe ? hierarchy[country]?.[classe]?.[newType] : undefined;
    onChange(
      country && classe ? { country, classe, type: newType, sourceCcy: newCcy, transform } : null,
    );
  }

  function handleTransformChange(i: SelectItem) {
    const newTransform = i.value as SeriesTransform;
    setTransform(newTransform);
    if (country && classe && type) {
      onChange({ country, classe, type, sourceCcy, transform: newTransform });
    }
  }

  const ccyObj = sourceCcy ? currencies.find((c) => c.code === sourceCcy) : undefined;

  return (
    <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        {color ? (
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
              color.badgeClassName,
            )}
          >
            {label}
          </span>
        ) : (
          <p className="text-sm font-semibold">{label}</p>
        )}
        {isReady ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
            <CheckCircle2Icon className="size-3.5" />
            Prête
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <CircleDashedIcon className="size-3.5" />
            Incomplète
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <CountryDropdown countries={countries} value={country} onChange={handleCountryChange} />
        <SelectDropdown
          items={availableClasses.map((c) => ({ value: c, label: c }))}
          value={classe}
          onChange={handleClasseChange}
          placeholder={country ? "Classe" : "— classe —"}
          className={!country ? "opacity-40 pointer-events-none" : ""}
        />
        <SelectDropdown
          items={availableTypes.map((t) => ({ value: t, label: t }))}
          value={type}
          onChange={handleTypeChange}
          placeholder={classe ? "Type" : "— type —"}
          className={!classe ? "opacity-40 pointer-events-none" : ""}
        />
        <SelectDropdown
          items={TRANSFORM_ITEMS}
          value={transform}
          onChange={handleTransformChange}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground min-h-8">
        <div className="flex items-center gap-2">
          <span>Devise source :</span>
          {isReady ? (
            ccyObj ? (
              <CurrencyBadge code={ccyObj.code} label={ccyObj.label} />
            ) : (
              <span className="text-muted-foreground italic">Aucune devise associée</span>
            )
          ) : (
            <span className="text-muted-foreground italic">—</span>
          )}
        </div>
        {error && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-error-200 bg-error-50 px-2 py-0.5 text-xs font-medium text-error-600 shrink-0 dark:border-error-700/40 dark:bg-error-950/40 dark:text-error-400">
            <AlertCircleIcon className="size-3.5" />
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── PlaygroundClient ─────────────────────────────────────────────────────────

type PersistedDateRange = { from?: string; to?: string } | null;

interface Props {
  options: FilterOptions;
  hierarchy: SeriesHierarchy;
}

export function PlaygroundClient({ options, hierarchy }: Props) {
  const { currencies } = options;

  const [series1, setSeries1] = useLsState<SeriesSelection | null>("playground.series1", null);
  const [series2, setSeries2] = useLsState<SeriesSelection | null>("playground.series2", null);
  const [displayCcy, setDisplayCcy] = useLsState<string | undefined>(
    "playground.displayCcy",
    undefined,
  );
  const [persistedDr, setPersistedDr] = useLsState<PersistedDateRange>(
    "playground.dateRange",
    null,
  );

  const dateRange: DateRange | undefined = persistedDr
    ? {
        from: persistedDr.from ? new Date(persistedDr.from) : undefined,
        to: persistedDr.to ? new Date(persistedDr.to) : undefined,
      }
    : undefined;

  function setDateRange(dr: DateRange | undefined) {
    setPersistedDr(dr ? { from: dr.from?.toISOString(), to: dr.to?.toISOString() } : null);
  }

  const [loaded1, setLoaded1] = useState<LoadedSeries | null>(null);
  const [loaded2, setLoaded2] = useState<LoadedSeries | null>(null);
  const [error1, setError1] = useState<string | null>(null);
  const [error2, setError2] = useState<string | null>(null);

  const cache = useRef<SeriesCache>(new Map());
  const [isPending, startTransition] = useTransition();

  const fetchSeries = useCallback(async (sel: SeriesSelection) => {
    const key = cacheKey(sel);
    if (cache.current.has(key))
      return { data: cache.current.get(key)!, error: null as string | null };
    const result = await loadSeries({
      country: sel.country,
      class: sel.classe,
      type: sel.type,
      ccy: sel.sourceCcy,
    });
    if ("error" in result) return { data: null, error: result.error };
    cache.current.set(key, result);
    return { data: result, error: null as string | null };
  }, []);

  useEffect(() => {
    if (!series1 || !series2) return;
    startTransition(async () => {
      const [r1, r2] = await Promise.all([fetchSeries(series1), fetchSeries(series2)]);
      setLoaded1(r1.data);
      setLoaded2(r2.data);
      setError1(r1.error);
      setError2(r2.error);
    });
  }, [series1, series2, displayCcy, persistedDr, fetchSeries]);

  const fromStr = dateRange?.from ? dateRange.from.toISOString() : "";
  const toStr = dateRange?.to ? dateRange.to.toISOString() : "";
  const filtered1 = loaded1 ? filterByDates(loaded1.data, fromStr, toStr) : [];
  const filtered2 = loaded2 ? filterByDates(loaded2.data, fromStr, toStr) : [];

  return (
    <div className="flex flex-col gap-4 w-fit mx-auto">
      {/* Séries — la key force le remontage de SeriesFilterRow quand la sélection
          restaurée depuis localStorage arrive, afin que useState() s'initialise
          avec la bonne initialSelection sans avoir besoin d'un effet. */}
      <div className="flex flex-col gap-4">
        <SeriesFilterRow
          key={series1 ? `s1-${cacheKey(series1)}` : "s1-empty"}
          options={options}
          hierarchy={hierarchy}
          label="Série 1"
          color={SERIE_COLORS.s1}
          error={error1}
          initialSelection={series1}
          onChange={(sel) => {
            setSeries1(sel);
            setLoaded1(null);
            setError1(null);
          }}
        />
        <SeriesFilterRow
          key={series2 ? `s2-${cacheKey(series2)}` : "s2-empty"}
          options={options}
          hierarchy={hierarchy}
          label="Série 2"
          color={SERIE_COLORS.s2}
          error={error2}
          initialSelection={series2}
          onChange={(sel) => {
            setSeries2(sel);
            setLoaded2(null);
            setError2(null);
          }}
        />
      </div>

      {/* Paramètres d'affichage */}
      <div className="rounded-lg border bg-muted/50 p-6 flex flex-col items-center justify-center gap-3">
        <div className="flex items-end gap-4">
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
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "size-9 self-end",
              dateRange ? "cursor-pointer" : "opacity-40 cursor-default",
            )}
            onClick={() => setDateRange(undefined)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Résultat temporaire — sera remplacé par le graphique */}
      {isPending && (
        <div className="rounded-lg border bg-muted/50 p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Chargement des données…
        </div>
      )}
      {!isPending && (loaded1 || loaded2) && (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3 text-sm">
          {loaded1 && (
            <p>
              <span className="font-semibold">Série 1 :</span> {loaded1.match.name} (
              {loaded1.match.code}) — <span className="font-mono">{filtered1.length}</span> points
            </p>
          )}
          {loaded2 && (
            <p>
              <span className="font-semibold">Série 2 :</span> {loaded2.match.name} (
              {loaded2.match.code}) — <span className="font-mono">{filtered2.length}</span> points
            </p>
          )}
        </div>
      )}
    </div>
  );
}
