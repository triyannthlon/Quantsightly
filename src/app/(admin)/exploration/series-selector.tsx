"use client";

import { useEffect, useMemo } from "react";
import { CheckCircle2Icon, CircleDashedIcon } from "lucide-react";
import { SelectDropdown, type SelectItem } from "@/components/custom/ui/select-dropdown";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { cn } from "@/lib/utils";
import type { EconomicSeries, ClassRef, TypeRef } from "@/lib/coredata/types";

const NONE = "__none__";

interface Props {
  series: EconomicSeries[];
  label: string;
  badgeClassName?: string;
  /** Ajoute l'option « Aucun » en tête de la liste pays (ligne B). */
  withNoneCountry?: boolean;
  /** Restreint pays / classes / types à ceux combinables (ligne B selon A). */
  allowedTypeRefs?: TypeRef[];
  country: string | null;
  classRef: ClassRef | null;
  typeRef: TypeRef | null;
  serieId: string | null;
  onCountryChange: (iso: string | null) => void;
  onClassChange: (c: ClassRef) => void;
  onTypeChange: (t: TypeRef) => void;
  onSerieChange: (s: EconomicSeries) => void;
  /** Devise d'affichage cible + liste disponible (apparaît après la mesure). */
  currencyItems: SelectItem[];
  currency: string | null;
  onCurrencyChange: (c: string) => void;
  /** Devise verrouillée (mesure non convertible : taux, PER, volume…). */
  currencyDisabled?: boolean;
}

export function SeriesSelector({
  series,
  label,
  badgeClassName,
  withNoneCountry,
  allowedTypeRefs,
  country,
  classRef,
  typeRef,
  serieId,
  onCountryChange,
  onClassChange,
  onTypeChange,
  onSerieChange,
  currencyItems,
  currency,
  onCurrencyChange,
  currencyDisabled,
}: Props) {
  // Prédicat : le type est-il combinable (contrainte éventuelle de la ligne B) ?
  const typeOk = useMemo(() => {
    const allowed = allowedTypeRefs;
    return (t: TypeRef) => !allowed || allowed.includes(t);
  }, [allowedTypeRefs]);

  // Pays ayant au moins une série combinable, triés par libellé FR.
  const countryItems = useMemo<SelectItem[]>(() => {
    const seen = new Map<string, string>();
    for (const s of series) {
      if (!typeOk(s.type)) continue;
      if (!seen.has(s.countryIso)) seen.set(s.countryIso, s.countryFr ?? s.countryIso);
    }
    const items = [...seen.entries()]
      .map(([iso, fr]) => ({
        value: iso,
        label: fr,
        // « XX » (Monde) → drapeau world.svg.
        icon: <CountryFlag code={iso === "XX" ? "world" : iso} countryName={fr} size={18} />,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
    return withNoneCountry ? [{ value: NONE, label: "Aucun" }, ...items] : items;
  }, [series, withNoneCountry, typeOk]);

  // Classes du pays ayant au moins un type combinable.
  const classItems = useMemo<SelectItem[]>(() => {
    if (!country) return [];
    const seen = new Map<ClassRef, string>();
    for (const s of series) {
      if (s.countryIso !== country || !typeOk(s.type)) continue;
      if (!seen.has(s.class)) seen.set(s.class, s.classFr);
    }
    return [...seen.entries()]
      .map(([ref, fr]) => ({ value: String(ref), label: fr }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [series, country, typeOk]);

  // Mesures réellement présentes en base pour le couple pays+classe (data-driven),
  // restreintes aux mesures combinables le cas échéant. On ne propose que ce qui
  // existe vraiment dans coredatadb.
  const typeItems = useMemo<SelectItem[]>(() => {
    if (!country || classRef === null) return [];
    const seen = new Map<TypeRef, string>();
    for (const s of series) {
      if (s.countryIso !== country || s.class !== classRef || !typeOk(s.type)) continue;
      if (!seen.has(s.type)) seen.set(s.type, s.typeFr);
    }
    return [...seen.entries()]
      .map(([ref, fr]) => ({ value: String(ref), label: fr }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [series, country, classRef, typeOk]);

  // Séries concrètes correspondant à pays+classe+type (>1 seulement pour
  // matières premières / crypto, où le pays « Monde » regroupe plusieurs actifs).
  const matches = useMemo<EconomicSeries[]>(() => {
    if (!country || classRef === null || typeRef === null) return [];
    return series
      .filter((s) => s.countryIso === country && s.class === classRef && s.type === typeRef)
      .sort((a, b) => a.tickerName.localeCompare(b.tickerName, "fr"));
  }, [series, country, classRef, typeRef]);

  // Résolution automatique quand un seul actif correspond.
  useEffect(() => {
    if (matches.length === 1 && serieId !== matches[0].id) onSerieChange(matches[0]);
  }, [matches, serieId, onSerieChange]);

  const isReady = serieId !== null;
  const needsDisambiguation = matches.length > 1;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
            badgeClassName ?? "bg-muted",
          )}
        >
          {label}
        </span>
        {isReady ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
            <CheckCircle2Icon className="size-3.5" />
            Prête
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <CircleDashedIcon className="size-3.5" />
            Incomplète
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SelectDropdown
          items={countryItems}
          value={country ?? undefined}
          onChange={(i) => onCountryChange(i.value === NONE ? null : i.value)}
          placeholder={withNoneCountry ? "Aucun" : "Pays"}
          width="w-48"
        />
        <SelectDropdown
          items={classItems}
          value={classRef !== null ? String(classRef) : undefined}
          onChange={(i) => onClassChange(Number(i.value) as ClassRef)}
          placeholder={country ? "Classe" : "— classe —"}
          width="w-48"
          className={!country ? "pointer-events-none opacity-40" : ""}
        />
        <SelectDropdown
          items={typeItems}
          value={typeRef !== null ? String(typeRef) : undefined}
          onChange={(i) => onTypeChange(Number(i.value) as TypeRef)}
          placeholder={classRef !== null ? "Mesure" : "— mesure —"}
          width="w-48"
          className={classRef === null ? "pointer-events-none opacity-40" : ""}
        />
        {needsDisambiguation && (
          <SelectDropdown
            items={matches.map((s) => ({ value: s.id, label: s.tickerName }))}
            value={serieId ?? undefined}
            onChange={(i) => {
              const s = matches.find((x) => x.id === i.value);
              if (s) onSerieChange(s);
            }}
            placeholder="Actif"
            width="w-48"
          />
        )}
        {serieId !== null && !currencyDisabled && currencyItems.length > 0 && (
          <SelectDropdown
            items={currencyItems}
            value={currency ?? undefined}
            onChange={(i) => onCurrencyChange(i.value)}
            placeholder="Devise"
            width="w-32"
          />
        )}
      </div>
    </div>
  );
}
