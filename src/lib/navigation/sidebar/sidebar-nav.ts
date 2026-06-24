// sidebar-nav.ts
import { House, ScanSearch, LineChart } from "lucide-react";
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

export const NAV = [
  {
    title: "",
    items: [
      {
        key: "home",
        label: "Accueil",
        href: routes.dashboard,
        icon: House,
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
      {
        key: "exploration",
        label: "Exploration",
        href: routes.exploration,
        icon: LineChart,
      },
    ],
  },
];
