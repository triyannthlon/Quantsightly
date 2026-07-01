// sidebar-nav.ts
import { Eye, ScanSearch, LineChart, Activity, Bookmark, Grid2x2 } from "lucide-react";
import React from "react";
import { routes } from "@/lib/navigation/sidebar/route";

export type NavChild = {
  label: string;
  href: string;
  tone?: "default" | "danger";
};

export type NavItem = {
  key: string;
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavChild[];
  tone?: "default" | "danger";
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

// Sidebar = parcours mental Quantsightly : comprendre → gérer → analyser →
// surveiller → chercher. On n'expose que les pages réelles ; les espaces à venir
// (Cockpit, Portefeuille, Comparaisons) s'insèreront à leur place réservée, au-
// dessus, sans re-architecturer.
export const NAV: NavSection[] = [
  {
    title: "Exploration",
    items: [
      {
        key: "comparateur",
        label: "Comparateur",
        href: routes.exploration,
        icon: LineChart,
      },
    ],
  },
  {
    title: "Comparaisons",
    items: [
      {
        key: "signaux",
        label: "Signaux macro",
        href: routes.comparisons.signals,
        icon: Activity,
      },
      {
        key: "regimes-pays",
        label: "Régimes macro",
        href: routes.comparisons.quadrants,
        icon: Grid2x2,
      },
      {
        key: "mes-comparaisons",
        label: "Mes comparaisons",
        href: routes.comparisons.saved,
        icon: Bookmark,
      },
    ],
  },
  {
    title: "Marchés",
    items: [
      {
        key: "watchlist",
        label: "Actifs suivis",
        href: routes.dashboard,
        icon: Eye,
      },
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
];
