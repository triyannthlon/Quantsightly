// sidebar-nav.ts
import {
  LayoutDashboard,
  SlidersHorizontal,
  LineChart,
  Activity,
  Bookmark,
  Shield,
  Grid2x2,
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
      { key: "mon-cockpit", label: "Mon cockpit", icon: SlidersHorizontal, disabled: true },
    ],
  },
  {
    title: "Exploration",
    items: [
      { key: "comparateur", label: "Comparateur", href: routes.exploration, icon: LineChart },
      { key: "signaux", label: "Signaux macro", href: routes.comparisons.signals, icon: Activity },
      // Temporaire : « Mes comparaisons » rejoindra « Mon cockpit » (espace
      // personnalisable) une fois celui-ci construit. Gardé cliquable ici pour
      // ne pas masquer une fonctionnalité déjà livrée.
      {
        key: "mes-comparaisons",
        label: "Mes comparaisons",
        href: routes.comparisons.saved,
        icon: Bookmark,
      },
    ],
  },
  {
    title: "Modèles",
    items: [
      { key: "browne", label: "Browne", icon: Shield, disabled: true },
      // Même page que l'ancien « Régimes macro » (route `/comparaisons/quadrants`
      // inchangée), déplacée ici et renommée « 4 Quadrants ».
      { key: "quadrants", label: "4 Quadrants", href: routes.comparisons.quadrants, icon: Grid2x2 },
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
