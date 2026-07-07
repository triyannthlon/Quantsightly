// sidebar-nav.ts
import {
  LayoutDashboard,
  SlidersHorizontal,
  LineChart,
  Activity,
  Shield,
  Grid2x2,
  Layers,
  PieChart,
  Stethoscope,
  Scale,
  Wallet,
  Eye,
  ScanSearch,
  Settings,
} from "lucide-react";
import React from "react";
import { routes } from "@/lib/navigation/sidebar/route";

export type NavChild = {
  label: string;
  href: string;
  tone?: "default" | "danger";
  disabled?: boolean;
};

export type NavItem = {
  key: string;
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavChild[];
  tone?: "default" | "danger";
  disabled?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

// Sidebar = parcours mental Quantsightly : comprendre la situation (Cockpit) →
// explorer les signaux (Exploration) → étudier les modèles de référence
// (Modèles) → analyser son portefeuille (Portefeuille) → suivre/chercher des
// actifs (Marchés) → configurer (Paramètres).
//
// Nav « hybride » : la structure cible est affichée en entier pour raconter le
// parcours dès maintenant ; les nœuds pas encore codés sont `disabled` (grisés,
// non-cliquables, badge « Bientôt »). On n'allume que le réel — la structure
// grandit vers le haut au fil des briques.
export const NAV: NavSection[] = [
  {
    title: "Cockpit",
    items: [
      { key: "vue-quantsightly", label: "Vue Quantsightly", icon: LayoutDashboard, disabled: true },
      // Point sur la page ex-« Mes comparaisons » (route inchangée), devenue
      // l'amorce de l'espace personnalisable. S'étoffera (actifs suivis, ratios…).
      {
        key: "mon-cockpit",
        label: "Mon cockpit",
        href: routes.comparisons.saved,
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    title: "Exploration",
    items: [
      { key: "comparateur", label: "Comparateur", href: routes.exploration, icon: LineChart },
      { key: "signaux", label: "Signaux macro", href: routes.comparisons.signals, icon: Activity },
      // Diagnostic live du régime (page existante `/comparaisons/quadrants`).
      {
        key: "regime-macro",
        label: "Régime macro",
        href: routes.comparisons.quadrants,
        icon: Grid2x2,
      },
    ],
  },
  {
    title: "Modèles",
    items: [
      { key: "browne", label: "Browne", icon: Shield, disabled: true },
      // Futur portefeuille MODÈLE : allocation de référence dérivée des régimes
      // macro (≠ la page de diagnostic « Régime macro » sous Exploration).
      { key: "quadrants-modele", label: "4 Quadrants", icon: Layers, disabled: true },
    ],
  },
  {
    title: "Portefeuille",
    items: [
      { key: "pf-vue", label: "Vue d'ensemble", icon: PieChart, disabled: true },
      { key: "pf-diagnostic", label: "Diagnostic", icon: Stethoscope, disabled: true },
      { key: "pf-comparaison", label: "Comparaison", icon: Scale, disabled: true },
      // Prochaine brique produit (entrée obligatoire du parcours portefeuille).
      { key: "pf-positions", label: "Positions", icon: Wallet, disabled: true },
    ],
  },
  {
    title: "Marchés",
    items: [
      { key: "watchlist", label: "Actifs suivis", href: routes.dashboard, icon: Eye },
      {
        key: "screener",
        label: "Screener",
        icon: ScanSearch,
        children: [
          { label: "Actions", href: routes.screener.stock },
          { label: "ETF", href: routes.screener.etf },
          { label: "Indices", href: routes.screener.index },
          { label: "Obligations", href: routes.screener.bond },
          { label: "Cryptomonnaies", href: routes.screener.crypto },
          { label: "Devises", href: routes.screener.currency },
        ],
      },
    ],
  },
  {
    // Section sans titre : Paramètres est un accès de bas de barre, pas encore codé.
    title: "",
    items: [{ key: "parametres", label: "Paramètres", icon: Settings, disabled: true }],
  },
];
