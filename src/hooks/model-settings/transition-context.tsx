"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

/**
 * Largeur de la zone de transition `T` (bande neutre des régimes macro), PARTAGÉE
 * par toutes les vues (Régimes macro + module 4 Quadrants) et persistée en
 * localStorage : elle ne revient plus à 20 à chaque changement de page.
 *
 * Monté dans src/app/(admin)/layout.tsx → englobe toutes les pages protégées.
 */

const STORAGE_KEY = "quantsightly:transition-width";
const DEFAULT_TRANSITION = 20;

type TransitionContextValue = {
  transitionWidth: number;
  setTransitionWidth: (t: number) => void;
};

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function TransitionProvider({ children }: { children: ReactNode }) {
  // 1er render = défaut (serveur ET client) → pas de hydration mismatch.
  const [transitionWidth, setState] = useState(DEFAULT_TRANSITION);

  // Hydrate depuis localStorage après mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const n = Number(stored);
        if (Number.isFinite(n) && n >= 0 && n <= 50) setState(Math.round(n));
      }
    } catch {
      /* localStorage indisponible → on reste sur le défaut */
    }
  }, []);

  const setTransitionWidth = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(50, Math.round(t)));
    setState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      /* silencieux */
    }
  }, []);

  return (
    <TransitionContext.Provider value={{ transitionWidth, setTransitionWidth }}>
      {children}
    </TransitionContext.Provider>
  );
}

export function useTransitionWidth(): TransitionContextValue {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error("useTransitionWidth() doit être utilisé à l'intérieur de <TransitionProvider>");
  return ctx;
}
