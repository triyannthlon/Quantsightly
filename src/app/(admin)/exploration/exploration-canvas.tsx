"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { format } from "date-fns";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectDropdown, type SelectItem } from "@/components/custom/ui/select-dropdown";
import { MonthRangePicker, type DateRange } from "@/components/custom/ui/month-range-picker";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { CURRENCY_FLAG } from "@/data/currencies";
import { cn } from "@/lib/utils";
import type {
  EconomicSeries,
  EconomicDataPoint,
  ReferenceData,
  FxRate,
  ClassRef,
  TypeRef,
  OperationKind,
} from "@/lib/coredata/types";
import {
  OPERATION_LABELS,
  isOperationAllowed,
  allowedOperations,
  allowedSecondTypes,
  isConvertibleMeasure,
} from "@/lib/coredata/authorization";
import {
  ratioSeries,
  differenceSeries,
  movingAverage,
  scaleSeries,
  commonDateBounds,
  filterByDateRange,
  usdPerUnitMap,
  convertCurrency,
  computeKpis,
  type SeriesKpis,
} from "@/lib/coredata/compute";
import { SeriesSelector } from "./series-selector";
import { ExplorationChart, type ChartLine, type ChartPoint } from "./exploration-chart";
import { ExplorationKpis } from "./exploration-kpis";
import { buildGraphTitle, buildStatsTitle, secondSectionTitle } from "./titles";
import { loadSeriesData } from "./actions";

const COLOR_PRIMARY = "var(--foreground)";
const COLOR_A = "#7E4A63"; // prune (superposition, série A)
const COLOR_B = "#2E4A6B"; // bleu  (superposition, série B)
const COLOR_MA = "#E8833A"; // orange (moyenne mobile)

const BADGE_A = "bg-[rgba(126,74,99,0.12)] border-[rgba(126,74,99,0.3)] text-[#7E4A63] dark:text-[#CE8DAD]";
const BADGE_B = "bg-[rgba(46,74,107,0.12)] border-[rgba(46,74,107,0.3)] text-[#2E4A6B] dark:text-[#94B0D1]";

// Symbole monétaire d'un code ISO 4217 (€, $, ¥…), via Intl. Repli sur le code.
function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch {
    return code;
  }
}

function currencyItem(code: string): SelectItem {
  const flagCode = CURRENCY_FLAG[code];
  return {
    value: code,
    label: code,
    icon: (
      <span className="flex shrink-0 items-center gap-1.5">
        {flagCode && <CountryFlag code={flagCode} countryName={code} size={18} />}
        <span className="w-4 text-center font-mono text-xs text-muted-foreground">
          {currencySymbol(code)}
        </span>
      </span>
    ),
  };
}

// Champ étiqueté de la section Analyse (libellé + contrôle).
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// Un bloc de performance (sans titre = série unique/ratio/différence ;
// avec titre coloré = une des deux séries en superposition).
type KpiBlock = { title?: string; color?: string; kpis: SeriesKpis };

interface Props {
  series: EconomicSeries[];
  reference: ReferenceData;
  fxRates: FxRate[];
}

interface Draft {
  country: string | null;
  classRef: ClassRef | null;
  typeRef: TypeRef | null;
  serie: EconomicSeries | null;
}

const EMPTY_DRAFT: Draft = { country: null, classRef: null, typeRef: null, serie: null };

export function ExplorationCanvas({ series, reference, fxRates }: Props) {

  const [a, setA] = useState<Draft>(EMPTY_DRAFT);
  const [b, setB] = useState<Draft>(EMPTY_DRAFT);
  const [currencyA, setCurrencyA] = useState<string | null>(null);
  const [currencyB, setCurrencyB] = useState<string | null>(null);
  const [operation, setOperation] = useState<OperationKind>("single");
  const [showMA, setShowMA] = useState(true);
  const [maYears, setMaYears] = useState(7);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const [dataA, setDataA] = useState<EconomicDataPoint[] | null>(null);
  const [dataB, setDataB] = useState<EconomicDataPoint[] | null>(null);
  const [isPending, startTransition] = useTransition();

  // ─── Taux de change : date → USD pour 1 unité, par devise ────────────────────

  const usdPerUnitByCurrency = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const fx of fxRates) m.set(fx.currency, usdPerUnitMap(fx.data, fx.reverse));
    return m;
  }, [fxRates]);

  const allCurrencyCodes = useMemo(() => {
    const set = new Set<string>(["USD"]);
    for (const fx of fxRates) set.add(fx.currency);
    return [...set].sort();
  }, [fxRates]);

  const currencyItemsFor = useCallback(
    (native: string | undefined, convertible: boolean): SelectItem[] => {
      if (!native) return [];
      if (!convertible) return [currencyItem(native)];
      const set = new Set<string>([native, ...allCurrencyCodes]);
      return [...set].sort().map(currencyItem);
    },
    [allCurrencyCodes],
  );

  const convert = useCallback(
    (data: EconomicDataPoint[], native: string, target: string | null): EconomicDataPoint[] => {
      // Pas de devise cible (série sans devise, ou cible = native) → tel quel.
      if (!target || target === native) return data;
      const src = native === "USD" ? null : usdPerUnitByCurrency.get(native) ?? null;
      const tgt = target === "USD" ? null : usdPerUnitByCurrency.get(target) ?? null;
      if ((native !== "USD" && !src) || (target !== "USD" && !tgt)) return data;
      return convertCurrency(data, src, tgt);
    },
    [usdPerUnitByCurrency],
  );

  // Devise par défaut d'affichage = devise du PAYS (table `countries`), pas la
  // native de la série. Ex. MSCI Brazil est coté en USD, mais le défaut pour le
  // Brésil est BRL (converti). Repli sur la native si mesure non convertible ou
  // devise pays indisponible / non convertible.
  const countryCurrency = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of reference.countries) if (c.currency) m.set(c.iso, c.currency);
    return m;
  }, [reference.countries]);

  const defaultCurrency = useCallback(
    (serie: EconomicSeries): string => {
      if (!isConvertibleMeasure(serie.type)) return serie.currency;
      const cur = countryCurrency.get(serie.countryIso);
      if (cur && (cur === "USD" || usdPerUnitByCurrency.has(cur))) return cur;
      return serie.currency;
    },
    [countryCurrency, usdPerUnitByCurrency],
  );

  // ─── Chargement des données ──────────────────────────────────────────────────

  const cache = useRef<Map<string, EconomicDataPoint[]>>(new Map());
  const fetchData = useCallback(async (serieId: string) => {
    const hit = cache.current.get(serieId);
    if (hit) return hit;
    const data = await loadSeriesData(serieId);
    cache.current.set(serieId, data);
    return data;
  }, []);

  useEffect(() => {
    if (!a.serie) {
      setDataA(null);
      return;
    }
    const id = a.serie.id;
    startTransition(async () => setDataA(await fetchData(id)));
  }, [a.serie, fetchData]);

  useEffect(() => {
    if (!b.serie) {
      setDataB(null);
      return;
    }
    const id = b.serie.id;
    startTransition(async () => setDataB(await fetchData(id)));
  }, [b.serie, fetchData]);

  // ─── Sélection (devise par défaut = native de la série résolue) ───────────────

  const setACountry = useCallback((country: string | null) => setA({ ...EMPTY_DRAFT, country }), []);
  const setAClass = useCallback(
    (classRef: ClassRef) => setA((s) => ({ ...s, classRef, typeRef: null, serie: null })),
    [],
  );
  const setAType = useCallback((typeRef: TypeRef) => setA((s) => ({ ...s, typeRef, serie: null })), []);
  const setASerie = useCallback(
    (serie: EconomicSeries) => {
      setA((s) => ({ ...s, serie }));
      setCurrencyA(defaultCurrency(serie));
    },
    [defaultCurrency],
  );

  const setBCountry = useCallback((country: string | null) => setB({ ...EMPTY_DRAFT, country }), []);
  const setBClass = useCallback(
    (classRef: ClassRef) => setB((s) => ({ ...s, classRef, typeRef: null, serie: null })),
    [],
  );
  const setBType = useCallback((typeRef: TypeRef) => setB((s) => ({ ...s, typeRef, serie: null })), []);
  const setBSerie = useCallback(
    (serie: EconomicSeries) => {
      setB((s) => ({ ...s, serie }));
      setCurrencyB(defaultCurrency(serie));
    },
    [defaultCurrency],
  );

  // ─── Opérations disponibles ─────────────────────────────────────────────────

  const availableOps = useMemo<OperationKind[]>(() => {
    if (!a.serie || a.typeRef === null) return [];
    if (!b.serie || b.typeRef === null) {
      return isOperationAllowed("single", a.typeRef) ? ["single"] : [];
    }
    return allowedOperations(a.typeRef, b.typeRef);
  }, [a.serie, a.typeRef, b.serie, b.typeRef]);

  useEffect(() => {
    if (availableOps.length === 0) return;
    if (!availableOps.includes(operation)) setOperation(availableOps[0]);
  }, [availableOps, operation]);

  const allowedBTypes = useMemo<TypeRef[] | undefined>(() => {
    if (a.typeRef === null) return undefined;
    const set = new Set<TypeRef>();
    for (const op of ["overlay", "ratio", "difference"] as const)
      for (const t of allowedSecondTypes(op, a.typeRef)) set.add(t);
    return [...set];
  }, [a.typeRef]);

  const bActive = b.country !== null;
  // Conversion possible seulement si la série a une devise native ET une mesure
  // convertible (prix / rendement total). Inflation, croissance, volume… n'ont
  // pas de devise → pas de conversion.
  const convertibleA =
    a.serie !== null && a.serie.currency !== "" && a.typeRef !== null && isConvertibleMeasure(a.typeRef);
  const convertibleB =
    b.serie !== null && b.serie.currency !== "" && b.typeRef !== null && isConvertibleMeasure(b.typeRef);

  // Rebasage base 100 automatique : uniquement quand on superpose deux PRIX
  // (mesures 1/2). Sans objet pour taux / PER / volume.
  const overlayPrices =
    operation === "overlay" &&
    a.typeRef !== null &&
    isConvertibleMeasure(a.typeRef) &&
    b.typeRef !== null &&
    isConvertibleMeasure(b.typeRef);

  // ─── Bornes de date ──────────────────────────────────────────────────────────

  const fromIso = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const toIso = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  // ─── Série affichée + KPIs ───────────────────────────────────────────────────

  const { chartData, lines, kpiBlocks } = useMemo(() => {
    if (!dataA || !a.serie) {
      return { chartData: [] as ChartPoint[], lines: [] as ChartLine[], kpiBlocks: [] as KpiBlock[] };
    }

    const convA = convert(dataA, a.serie.currency, currencyA);
    const convB = dataB && b.serie ? convert(dataB, b.serie.currency, currencyB) : null;

    let primary: EconomicDataPoint[] = [];
    let secondary: EconomicDataPoint[] | null = null;
    const chartLines: ChartLine[] = [];

    if (operation === "single") {
      primary = convA;
      chartLines.push({ key: "primary", label: a.serie.tickerName, color: COLOR_PRIMARY });
    } else if (operation === "overlay" && convB) {
      primary = convA;
      secondary = convB;
      chartLines.push({ key: "primary", label: a.serie.tickerName, color: COLOR_A });
      chartLines.push({ key: "secondary", label: b.serie?.tickerName ?? "B", color: COLOR_B });
    } else if (operation === "ratio" && convB) {
      primary = ratioSeries(convA, convB);
      chartLines.push({ key: "primary", label: "Ratio", color: COLOR_PRIMARY });
    } else if (operation === "difference" && convB) {
      primary = differenceSeries(convA, convB);
      chartLines.push({ key: "primary", label: "Différence", color: COLOR_PRIMARY });
    } else {
      return { chartData: [] as ChartPoint[], lines: [] as ChartLine[], kpiBlocks: [] as KpiBlock[] };
    }

    // La MM nécessite une seule courbe → exclue en superposition (2 courbes).
    const ma =
      showMA && maYears > 0 && operation !== "overlay" ? movingAverage(primary, maYears * 12) : null;

    // Sans plage manuelle, deux séries sont bornées à leur période commune.
    let effFrom = fromIso;
    let effTo = toIso;
    if (!fromIso && !toIso && convB && operation !== "single") {
      const bounds = commonDateBounds(convA, convB);
      if (bounds) {
        effFrom = bounds.from;
        effTo = bounds.to;
      }
    }

    const primaryF = filterByDateRange(primary, effFrom, effTo);
    const secondaryF = secondary ? filterByDateRange(secondary, effFrom, effTo) : null;
    const maF = ma ? filterByDateRange(ma, effFrom, effTo) : null;

    // Superposition de deux prix → rebasage base 100 automatique : chaque courbe
    // part de 100 au bord gauche pour comparer les performances. La MM, linéaire,
    // est mise à l'échelle par le même facteur que sa série (A).
    let dispPrimary = primaryF;
    let dispSecondary = secondaryF;
    let dispMa = maF;
    if (overlayPrices) {
      const fA = primaryF[0]?.value ? 100 / primaryF[0].value : 1;
      dispPrimary = scaleSeries(primaryF, fA);
      dispMa = maF ? scaleSeries(maF, fA) : null;
      if (secondaryF) {
        const fB = secondaryF[0]?.value ? 100 / secondaryF[0].value : 1;
        dispSecondary = scaleSeries(secondaryF, fB);
      }
    }

    if (dispMa && dispMa.length > 0) {
      // La MM porte sur la courbe principale (série A, ratio ou différence selon
      // l'opération) — on le précise dans la légende.
      chartLines.push({
        key: "ma",
        label: `MM ${maYears} · ${chartLines[0].label}`,
        color: COLOR_MA,
        dashed: true,
      });
    }

    const byDate = new Map<string, ChartPoint>();
    const ensure = (date: string) => {
      let p = byDate.get(date);
      if (!p) {
        p = { date };
        byDate.set(date, p);
      }
      return p;
    };
    for (const p of dispPrimary) ensure(p.date).primary = p.value;
    if (dispSecondary) for (const p of dispSecondary) ensure(p.date).secondary = p.value;
    if (dispMa) for (const p of dispMa) ensure(p.date).ma = p.value;

    // En base 100, on conserve aussi les vrais prix (convertis, non rebasés)
    // pour l'infobulle (les courbes restent en base 100).
    if (overlayPrices) {
      for (const p of primaryF) {
        const e = byDate.get(p.date);
        if (e) e.primaryRaw = p.value;
      }
      if (secondaryF) {
        for (const p of secondaryF) {
          const e = byDate.get(p.date);
          if (e) e.secondaryRaw = p.value;
        }
      }
    }

    // En superposition : un bloc de perf par série (couleur = courbe). Sinon,
    // un seul bloc (sur la courbe résultante : série, ratio ou différence).
    // Deux séries identiques (même actif, même devise) → un seul bloc.
    const identical = b.serie != null && a.serie.id === b.serie.id && currencyA === currencyB;
    const blocks: KpiBlock[] =
      operation === "overlay" && secondaryF && !identical
        ? [
            { title: a.serie.tickerName, color: COLOR_A, kpis: computeKpis(primaryF) },
            { title: b.serie?.tickerName ?? "Série B", color: COLOR_B, kpis: computeKpis(secondaryF) },
          ]
        : [{ kpis: computeKpis(primaryF) }];

    const merged = [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date));
    return { chartData: merged, lines: chartLines, kpiBlocks: blocks };
  }, [dataA, dataB, operation, overlayPrices, showMA, maYears, fromIso, toIso, a.serie, b.serie, currencyA, currencyB, convert]);

  const hasResult = chartData.length > 0;

  // ─── Titres (graphique + panneau de stats) ───────────────────────────────────

  const titledA = a.serie ? { serie: a.serie, currency: currencyA ?? "" } : null;
  const titledB = b.serie ? { serie: b.serie, currency: currencyB ?? "" } : null;

  const title = useMemo(
    () => (titledA ? buildGraphTitle(operation, titledA, titledB) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operation, a.serie, b.serie, currencyA, currencyB],
  );

  const statsTitle = useMemo(
    () => (titledA ? buildStatsTitle(operation, titledA, titledB) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operation, a.serie, b.serie, currencyA, currencyB],
  );

  const statsSecondTitle = a.serie ? secondSectionTitle(operation, a.serie.type) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Exploration</h1>
        <p className="text-sm text-muted-foreground">
          Comparer deux pays ou afficher un seul indicateur économique.
        </p>
      </header>

      {/* Ligne A */}
      <SeriesSelector
        series={series}
        label="Série A"
        badgeClassName={BADGE_A}
        country={a.country}
        classRef={a.classRef}
        typeRef={a.typeRef}
        serieId={a.serie?.id ?? null}
        onCountryChange={setACountry}
        onClassChange={setAClass}
        onTypeChange={setAType}
        onSerieChange={setASerie}
        currencyItems={currencyItemsFor(a.serie?.currency, convertibleA)}
        currency={currencyA}
        onCurrencyChange={setCurrencyA}
        currencyDisabled={!convertibleA}
      />

      {/* Ligne B */}
      <SeriesSelector
        series={series}
        label="Série B"
        badgeClassName={BADGE_B}
        withNoneCountry
        allowedTypeRefs={allowedBTypes}
        country={b.country}
        classRef={b.classRef}
        typeRef={b.typeRef}
        serieId={b.serie?.id ?? null}
        onCountryChange={setBCountry}
        onClassChange={setBClass}
        onTypeChange={setBType}
        onSerieChange={setBSerie}
        currencyItems={currencyItemsFor(b.serie?.currency, convertibleB)}
        currency={currencyB}
        onCurrencyChange={setCurrencyB}
        currencyDisabled={!convertibleB}
      />

      {/* Analyse — ce qu'on fait avec les séries + les outils d'analyse */}
      <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
        <span className="inline-flex items-center rounded-md border bg-muted px-2 py-0.5 text-xs font-semibold">
          Analyse
        </span>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex items-end gap-2">
            <MonthRangePicker value={dateRange} onChange={setDateRange} />
            <Button
              variant="outline"
              size="icon"
              className={cn("size-9", dateRange ? "cursor-pointer" : "opacity-40")}
              onClick={() => setDateRange(undefined)}
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          {bActive && availableOps.length > 0 && (
            <Field label="Affichage">
              <SelectDropdown
                items={availableOps.map((op) => ({ value: op, label: OPERATION_LABELS[op] }))}
                value={operation}
                onChange={(i) => setOperation(i.value as OperationKind)}
                placeholder="Opération"
                width="w-44"
              />
            </Field>
          )}

          {operation !== "overlay" && (
            <Field label="Signal">
              <Button
                size="sm"
                variant={showMA ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setShowMA((v) => !v)}
              >
                Moyenne Mobile
              </Button>
              <Input
                type="number"
                min={1}
                max={20}
                value={maYears}
                onChange={(e) => setMaYears(Math.max(1, Number(e.target.value) || 1))}
                className="w-16"
                disabled={!showMA}
              />
              <span className="text-sm text-muted-foreground">ans</span>
            </Field>
          )}
        </div>
      </div>

      {/* Résultat */}
      {isPending && (
        <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/50 p-10 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Chargement des données…
        </div>
      )}

      {!isPending && hasResult && (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,340px)]">
          <div className="rounded-lg border bg-card p-4">
            {title && <h2 className="mb-3 text-center text-base font-medium">{title}</h2>}
            <ExplorationChart data={chartData} lines={lines} />
          </div>
          <ExplorationKpis
            columns={kpiBlocks}
            title={statsTitle ?? undefined}
            secondTitle={statsSecondTitle}
          />
        </div>
      )}

      {!isPending && !hasResult && (
        <div className="rounded-lg border bg-muted/50 p-10 text-center text-sm text-muted-foreground">
          Sélectionnez un pays pour la série A.
        </div>
      )}
    </div>
  );
}
