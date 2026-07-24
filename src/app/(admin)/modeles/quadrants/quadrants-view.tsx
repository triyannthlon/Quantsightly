"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  LineChart,
  Table2,
  Swords,
  Scale,
  BookOpen,
  SlidersHorizontal,
  Zap,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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
import {
  loadCountryQuadrantModel,
  loadQuadrantComparison,
  loadModelComparison,
  loadEnergyLabComparison,
} from "./actions";
import { EnergyLabView, ENERGY_LAB_SECTIONS } from "./energy-lab-view";
import { ACTIVE_REALLOCATION_BAND, IS_STAGING_V2 } from "./model-version-active";
import { REGION_ITEMS, type PerfMode, type QuadrantRegion } from "./helpers";
import { availabilityMessage, type AvailabilityReason } from "./availability-message";
import {
  QuadrantsVsBrowneView,
  VS_BROWNE_SECTIONS,
  type ComparisonFilter,
} from "./quadrants-vs-browne-view";
// Constantes PURES uniquement (jamais le barrel model-comparison côté client).
import { COST_BPS_OPTIONS, DEFAULT_COST_BPS } from "@/lib/coredata/model-comparison/constants";

// Statut de modèle non-OK → cause d'indisponibilité (message homogène, cf. helper).
const MODEL_REASON: Record<Exclude<QuadrantModelStatus, "OK">, AvailabilityReason> = {
  MISSING_SERIES: "missing_series",
  INVALID_VALUE: "invalid_value",
  INSUFFICIENT_HISTORY: "insufficient_history",
};

type Tab = "country" | "comparison" | "vs_actions" | "vs_browne" | "methodology" | "energie";
type Period = "MAX" | "20A" | "10A" | "5A";

// Onglets PUBLICS (toujours affichés). L'onglet interne « Énergie » est ajouté à l'exécution
// uniquement quand le labo est activé (gate `QS_ENERGY_LAB_ENABLED`, cf. `energyLabEnabled`).
const TABS: { key: Tab; label: string; icon: typeof LineChart; ready: boolean }[] = [
  { key: "country", label: "Vue pays", icon: LineChart, ready: true },
  { key: "comparison", label: "Comparaison pays", icon: Table2, ready: true },
  { key: "vs_actions", label: "4 Quadrants vs Actions", icon: Swords, ready: true },
  { key: "vs_browne", label: "4 Quadrants vs Browne", icon: Scale, ready: true },
  { key: "methodology", label: "Méthodologie", icon: BookOpen, ready: true },
];

// Onglet INTERNE gated (staging) — jamais dans `TABS` par défaut : visibilité ≠ calcul.
const ENERGY_TAB = { key: "energie" as Tab, label: "Énergie", icon: Zap, ready: true };

// Navigation interne par onglet.
const SECTIONS: Record<Tab, StickyNavSection[]> = {
  country: [
    { id: "resume", label: "Résumé" },
    { id: "indicateurs", label: "Indicateurs" },
    { id: "performance", label: "Performance" },
    { id: "drawdown", label: "Drawdown" },
    { id: "extremes", label: "Mois extrêmes" },
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
  vs_browne: VS_BROWNE_SECTIONS,
  methodology: METHODOLOGY_SECTIONS,
  energie: ENERGY_LAB_SECTIONS,
};

const PERIOD_ITEMS: SelectItem[] = [
  { value: "MAX", label: "Max" },
  { value: "20A", label: "20 ans" },
  { value: "10A", label: "10 ans" },
  { value: "5A", label: "5 ans" },
];
const PERIOD_YEARS: Record<Period, number | null> = { MAX: null, "20A": 20, "10A": 10, "5A": 5 };
// Labo Énergie : mêmes valeurs `Period` (MAX = `null` = pas de sous-fenêtrage) mais « MAX » se lit
// « Historique commun » — sous-période d'analyse À L'INTÉRIEUR de la fenêtre commune aux 2 stratégies.
const ENERGY_PERIOD_ITEMS: SelectItem[] = [
  { value: "MAX", label: "Historique commun" },
  { value: "20A", label: "20 ans" },
  { value: "10A", label: "10 ans" },
  { value: "5A", label: "5 ans" },
];
const ENERGY_PERIOD_TIP =
  "Réduit la période d’évaluation des deux stratégies sans modifier les règles du modèle ni l’historique utilisé pour calculer le signal.";
const DEVISE_ITEMS: SelectItem[] = [{ value: "local", label: "Locale" }];
const MODE_ITEMS: SelectItem[] = [
  { value: "nominal", label: "Nominal" },
  { value: "real", label: "Réel" },
  { value: "nominal_vs_inflation", label: "Nominal vs Inflation" },
];
const STRATEGY_ITEMS: SelectItem[] = [
  { value: "binary", label: "Allocation par régime" },
  { value: "dynamic", label: "Allocation continue" },
];
// Onglet « 4Q vs Browne » : mode restreint (Nominal / Réel) + filtre de comparaison + coûts.
const MODE_ITEMS_VS_BROWNE: SelectItem[] = [
  { value: "nominal", label: "Nominal" },
  { value: "real", label: "Réel" },
];
const COMPARISON_ITEMS: SelectItem[] = [
  { value: "all", label: "Toutes les stratégies" },
  { value: "dyn_browne", label: "Continue vs Browne" },
  { value: "bin_browne", label: "Régime vs Browne" },
  { value: "dyn_bin", label: "Continue vs Régime" },
];
const COST_ITEMS: SelectItem[] = COST_BPS_OPTIONS.map((b) => ({
  value: String(b),
  label: `${b} bps`,
}));
const COST_STORAGE_KEY = "quantsightly:vs-browne-cost-bps";

function Control({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {tip && (
          // La barre de contrôles n'est pas enveloppée d'un TooltipProvider (chaque VUE a le sien) :
          // on en fournit un local pour cette seule infobulle, cohérent avec le tooltip sombre partagé.
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`À propos : ${label}`}
                  className="cursor-help text-muted-foreground/60 hover:text-foreground"
                >
                  <Info className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64">
                {tip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      {children}
    </div>
  );
}

export function QuadrantsView({
  countries,
  defaultCountry,
  energyLabEnabled,
  initial,
}: {
  countries: { iso: string; nameFr: string }[];
  defaultCountry: string;
  /** Gate UI du laboratoire Énergie (staging). Ne pilote AUCUN calcul : visibilité de l'onglet seul. */
  energyLabEnabled: boolean;
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

  // Onglet « 4Q vs Browne » (étape 3) : calcul SERVEUR via action `loadModelComparison`.
  const [vsBrowne, setVsBrowne] = useState<
    Awaited<ReturnType<typeof loadModelComparison>> | undefined
  >(undefined);
  const [vsBrowneLoading, setVsBrowneLoading] = useState(false);
  // Étape 5 : filtre d'affichage + hypothèse de coûts (persistée).
  const [comparisonFilter, setComparisonFilter] = useState<ComparisonFilter>("all");
  const [costBps, setCostBps] = useState<number>(DEFAULT_COST_BPS);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COST_STORAGE_KEY);
      if (stored !== null && COST_BPS_OPTIONS.includes(Number(stored))) setCostBps(Number(stored));
    } catch {
      /* localStorage indisponible → défaut 25 bps */
    }
  }, []);
  const updateCost = (b: number) => {
    setCostBps(b);
    try {
      localStorage.setItem(COST_STORAGE_KEY, String(b));
    } catch {
      /* silencieux */
    }
  };
  const vsBrowneMode: "nominal" | "real" = perfMode === "real" ? "real" : "nominal";

  // Onglet INTERNE « Énergie » (gated). Calcul SERVEUR (moteur + 5ᵉ poche hors bundle client).
  // La stratégie active de la page (Continue/Régime) = la stratégie du labo (mêmes IDs moteur).
  const [energyLab, setEnergyLab] = useState<
    Awaited<ReturnType<typeof loadEnergyLabComparison>> | undefined
  >(undefined);
  const [energyLabLoading, setEnergyLabLoading] = useState(false);
  // Mode restreint (Nominal / Réel) partagé avec « vs Browne » — la bascule est instantanée
  // (les deux modes + leurs crises sont déjà dans les données ; aucun aller-retour serveur).
  const energyLabMode = vsBrowneMode;

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
            reallocationBand: ACTIVE_REALLOCATION_BAND, // v1 : null → comportement historique
          })
        : null,
    // ⚠️ `ACTIVE_REALLOCATION_BAND` (la version) est une CONSTANTE DE BUILD (flag inline) :
    // toute l'instance rend une seule version, aucun mélange v1/v2 possible à l'exécution → aucune
    // dépendance de mémoïsation nécessaire. Si la version devenait dynamique (état/prop), l'ajouter
    // ici ET aux clés des actions serveur.
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

  // Onglet « 4Q vs Browne » : calcul SERVEUR (le moteur reste hors du bundle client).
  // Étape 3 = params simples (mode réel/nominal, coûts 25 bps figés). Le filtre, les
  // coûts réglables et l'état d'URL viendront aux étapes suivantes.
  useEffect(() => {
    if (tab !== "vs_browne") return;
    let ignore = false;
    setVsBrowneLoading(true);
    loadModelComparison(country, {
      period: PERIOD_YEARS[period],
      mode: vsBrowneMode,
      costBps,
      transitionWidth,
    })
      .then((r) => {
        if (!ignore) setVsBrowne(r);
      })
      .finally(() => {
        if (!ignore) setVsBrowneLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [tab, country, period, vsBrowneMode, costBps, transitionWidth]);

  // Onglet « Énergie » (gated) : recharge au changement de pays / stratégie / sous-période. Le mode
  // reste client-side (les deux modes sont déjà dans les données). Ne tourne JAMAIS si le labo est off.
  // `PERIOD_YEARS[period]` (null pour « Historique commun ») = sous-période appliquée aux 2 variantes.
  useEffect(() => {
    if (!energyLabEnabled || tab !== "energie") return;
    let ignore = false;
    setEnergyLabLoading(true);
    loadEnergyLabComparison(country, strategy, PERIOD_YEARS[period])
      .then((r) => {
        if (!ignore) setEnergyLab(r);
      })
      .finally(() => {
        if (!ignore) setEnergyLabLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [energyLabEnabled, tab, country, strategy, period]);

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

  // Contrôles complets (bloc initial + panneau « Modifier »). Barre DÉCLARATIVE : une
  // liste de 5 champs strictement identiques (Control + SelectDropdown), partagée par
  // tous les onglets — seuls les items/valeurs varient. Aucune implémentation parallèle.
  const renderControls = () => {
    // Mode restreint (Nominal / Réel) pour « vs Browne » et le labo « Énergie ».
    const restrictedMode = tab === "vs_browne" || tab === "energie";
    type Field = { key: string; label: string; node: React.ReactNode; tip?: string };
    const fields: (Field | null)[] = [
      isRegionTab
        ? {
            key: "region",
            label: "Région",
            node: (
              <SelectDropdown
                items={REGION_ITEMS}
                value={region}
                onChange={(i) => setRegion(i.value as QuadrantRegion)}
                width="w-full"
              />
            ),
          }
        : {
            key: "country",
            label: "Pays",
            node: (
              <SelectDropdown
                items={countryItems}
                value={country}
                onChange={(i) => onCountry(i.value)}
                width="w-full"
              />
            ),
          },
      // Période : le labo l'interprète comme une SOUS-PÉRIODE dans la fenêtre commune (défaut
      // « Historique commun » = MAX = pas de sous-fenêtrage) ; les autres onglets = Max/20/10/5 ans.
      tab === "energie"
        ? {
            key: "period",
            label: "Période",
            tip: ENERGY_PERIOD_TIP,
            node: (
              <SelectDropdown
                items={ENERGY_PERIOD_ITEMS}
                value={period}
                onChange={(i) => setPeriod(i.value as Period)}
                width="w-full"
              />
            ),
          }
        : {
            key: "period",
            label: "Période",
            node: (
              <SelectDropdown
                items={PERIOD_ITEMS}
                value={period}
                onChange={(i) => setPeriod(i.value as Period)}
                width="w-full"
              />
            ),
          },
      {
        // Devise = LOCALE uniquement (V1) : même contrôle que les autres onglets ;
        // l'explication passe en note discrète sous la barre (cf. plus bas).
        key: "devise",
        label: "Devise d’analyse",
        node: <SelectDropdown items={DEVISE_ITEMS} value="local" width="w-full" />,
      },
      {
        key: "mode",
        label: "Mode d’analyse",
        node: (
          <SelectDropdown
            items={restrictedMode ? MODE_ITEMS_VS_BROWNE : MODE_ITEMS}
            value={restrictedMode ? vsBrowneMode : perfMode}
            onChange={(i) => setPerfMode(i.value as PerfMode)}
            width="w-full"
          />
        ),
      },
      tab === "vs_browne"
        ? {
            key: "comparison",
            label: "Comparaison",
            node: (
              <SelectDropdown
                items={COMPARISON_ITEMS}
                value={comparisonFilter}
                onChange={(i) => setComparisonFilter(i.value as ComparisonFilter)}
                width="w-full"
              />
            ),
          }
        : {
            key: "strategy",
            label: "Stratégie",
            node: (
              <SelectDropdown
                items={STRATEGY_ITEMS}
                value={strategy}
                onChange={(i) => setStrategy(i.value as Strategy)}
                width="w-full"
              />
            ),
          },
    ];
    const visibleFields = fields.filter((f): f is Field => f !== null);
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visibleFields.map((f) => (
            <Control key={f.key} label={f.label} tip={f.tip}>
              {f.node}
            </Control>
          ))}
        </div>
        {tab === "vs_browne" && (
          <p className="text-xs text-muted-foreground">
            Résultats exprimés dans la devise locale du pays
          </p>
        )}
        {tab === "energie" && (
          <p className="text-xs text-muted-foreground">
            Laboratoire interne · comparaison sur une fenêtre strictement commune · historique
            commun par défaut
          </p>
        )}
      </div>
    );
  };

  // Résumé compact des valeurs actives (barre condensée).
  const summary: StickySummaryItem[] =
    tab === "vs_browne"
      ? [
          { label: "Pays", value: countries.find((c) => c.iso === country)?.nameFr ?? country },
          {
            label: "Période",
            value: PERIOD_ITEMS.find((i) => i.value === period)?.label ?? period,
          },
          {
            label: "Mode",
            value:
              MODE_ITEMS_VS_BROWNE.find((i) => i.value === vsBrowneMode)?.label ?? vsBrowneMode,
          },
          {
            label: "Comparaison",
            value:
              COMPARISON_ITEMS.find((i) => i.value === comparisonFilter)?.label ?? comparisonFilter,
          },
          { label: "Coûts", value: `${costBps} bps` },
        ]
      : tab === "energie"
        ? [
            { label: "Pays", value: countries.find((c) => c.iso === country)?.nameFr ?? country },
            {
              label: "Période",
              value: ENERGY_PERIOD_ITEMS.find((i) => i.value === period)?.label ?? period,
            },
            { label: "Devise", value: "Locale" },
            {
              label: "Mode",
              value:
                MODE_ITEMS_VS_BROWNE.find((i) => i.value === energyLabMode)?.label ?? energyLabMode,
            },
            {
              label: "Stratégie",
              value: STRATEGY_ITEMS.find((i) => i.value === strategy)?.label ?? strategy,
            },
          ]
        : [
            isRegionTab
              ? {
                  label: "Région",
                  value: REGION_ITEMS.find((i) => i.value === region)?.label ?? region,
                }
              : {
                  label: "Pays",
                  value: countries.find((c) => c.iso === country)?.nameFr ?? country,
                },
            {
              label: "Période",
              value: PERIOD_ITEMS.find((i) => i.value === period)?.label ?? period,
            },
            { label: "Devise", value: "Locale" },
            {
              label: "Mode",
              value: MODE_ITEMS.find((i) => i.value === perfMode)?.label ?? perfMode,
            },
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

  // L'onglet interne « Énergie » n'apparaît QUE si le labo est activé (gate serveur). Off ⇒
  // onglet absent et branche de rendu inaccessible : l'ouvrir ne changerait de toute façon
  // AUCUN calcul public (visibilité ≠ activation moteur).
  const tabs = energyLabEnabled ? [...TABS, ENERGY_TAB] : TABS;

  return (
    <>
      {IS_STAGING_V2 && (
        <div
          className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
          role="status"
        >
          <span className="inline-block size-1.5 rounded-full bg-amber-500" aria-hidden />
          Recette interne · moteur <span className="font-semibold">4q-standard-v2-rc1</span> actif
          (non destiné à la production)
        </div>
      )}
      <ModelStickyControls
        tabs={tabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as Tab)}
        headerExtra={reglagesButton}
        showParams={tab !== "methodology"}
        renderControls={renderControls}
        summary={summary}
        sections={SECTIONS[tab]}
        loading={
          pending ||
          (tab === "vs_browne" && vsBrowneLoading) ||
          (tab === "energie" && energyLabLoading)
        }
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
        ) : tab === "vs_browne" ? (
          vsBrowne === undefined ? (
            // Premier chargement uniquement : aucun contenu antérieur à préserver.
            <Card className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Calcul de la comparaison…
            </Card>
          ) : vsBrowne ? (
            // Recalcul (période / pays / mode) : on GARDE le contenu précédent monté (juste
            // atténué) au lieu de le remplacer par une carte courte → la hauteur reste stable et
            // la position de scroll est préservée, comme sur l'onglet « pays ».
            <div
              className={cn(vsBrowneLoading && "pointer-events-none opacity-60 transition-opacity")}
            >
              <QuadrantsVsBrowneView
                result={vsBrowne.net}
                grossResult={vsBrowne.gross}
                crisisResults={vsBrowne.crisisResults}
                filter={comparisonFilter}
                costBps={costBps}
              />
            </div>
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Données insuffisantes pour comparer les modèles sur ce pays.
            </Card>
          )
        ) : tab === "energie" && energyLabEnabled ? (
          energyLab === undefined ? (
            // Premier chargement uniquement : aucun contenu antérieur à préserver.
            <Card className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Calcul du laboratoire Énergie…
            </Card>
          ) : energyLab ? (
            // Recalcul (pays / stratégie) : on GARDE le contenu précédent monté (juste atténué)
            // pour préserver la hauteur et la position de scroll, comme les autres onglets.
            <div
              className={cn(
                energyLabLoading && "pointer-events-none opacity-60 transition-opacity",
              )}
            >
              <EnergyLabView
                comparison={energyLab.comparison}
                crises={energyLab.crises}
                mode={energyLabMode}
              />
            </div>
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Données insuffisantes pour le laboratoire Énergie sur ce pays.
            </Card>
          )
        ) : (
          <QuadrantsMethodology />
        )}
      </ModelStickyControls>

      <ModelSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        extra={
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">Coûts de transaction (4 Quadrants vs Browne)</p>
              <span className="text-sm font-semibold tabular-nums">{costBps} bps</span>
            </div>
            <div className="mt-2.5 flex gap-2">
              {COST_ITEMS.map((c) => (
                <Button
                  key={c.value}
                  variant={Number(c.value) === costBps ? "default" : "outline"}
                  size="sm"
                  className="flex-1 cursor-pointer"
                  onClick={() => updateCost(Number(c.value))}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Appliqués à la rotation réellement exécutée. Les performances et métriques de l’onglet
              « 4 Quadrants vs Browne » sont nettes de ces coûts (25 bps par défaut).
            </p>
          </div>
        }
      />
    </>
  );
}
