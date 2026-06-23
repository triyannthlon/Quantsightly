"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Period } from "@/components/custom/asset-panel/asset-panel";

/**
 * Période de référence partagée par TOUTES les vues de l'app authentifiée
 * (dashboard + screeners). Persistée en localStorage pour survivre aux refresh.
 *
 * Monté dans src/app/(admin)/layout.tsx → englobe toutes les pages protégées.
 */

const STORAGE_KEY = "quantsightly:period";
const DEFAULT_PERIOD: Period = "1A";
const VALID_PERIODS: readonly Period[] = ["1M", "3M", "6M", "YTD", "1A", "3A", "5A", "MAX"];

type PeriodContextValue = {
  period: Period;
  setPeriod: (p: Period) => void;
};

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  // 1er render = DEFAULT_PERIOD (côté serveur ET client) → pas de hydration mismatch.
  const [period, setPeriodState] = useState<Period>(DEFAULT_PERIOD);

  // Hydrate depuis localStorage après mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_PERIODS.includes(stored as Period)) {
        setPeriodState(stored as Period);
      }
    } catch {
      /* localStorage indisponible (mode privé, quota dépassé) → on reste sur le default */
    }
  }, []);

  // Setter qui persiste à chaque changement.
  const setPeriod = useCallback((p: Period) => {
    setPeriodState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* silencieux : l'app continue de marcher sans persistance */
    }
  }, []);

  return <PeriodContext.Provider value={{ period, setPeriod }}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod() doit être utilisé à l'intérieur de <PeriodProvider>");
  return ctx;
}
