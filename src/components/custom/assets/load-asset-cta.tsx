"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { useOnDemandLoad } from "@/hooks/assets/use-on-demand-load";

type Props = {
  initialQuery: string;
  onResetAction: () => void;
};

const SYMBOL_REGEX = /^[A-Z0-9.-]+\.[A-Z]+$/;
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

function isValidInput(input: string): boolean {
  const u = input.trim().toUpperCase();
  return SYMBOL_REGEX.test(u) || ISIN_REGEX.test(u);
}

export function LoadAssetCta({ initialQuery, onResetAction }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery.toUpperCase());
  const { state, load, reset } = useOnDemandLoad();

  const isInputValid = isValidInput(value);

  const handleSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = (e) => {
    e.preventDefault();
    if (!isInputValid) return;
    void load(value);
  };

  const handleNewSearch = () => {
    reset();
    onResetAction();
  };

  const handleNavigate = () => {
    if (state.status !== "success") return;
    router.push(`/playground/assets/${state.route}/${state.symbol}`);
  };

  // ────────── État : idle ou submitting ──────────
  if (state.status === "idle" || state.status === "submitting") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-popover text-popover-foreground border border-border rounded-xl"
      >
        <p className="text-sm text-foreground mb-2 font-medium">
          Aucun résultat dans notre base.
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Si vous connaissez le symbol exact (ex&nbsp;: <span className="font-mono">VWCE.XETRA</span>)
          ou le code ISIN (ex&nbsp;: <span className="font-mono">IE00BK5BQT80</span>),
          nous pouvons charger cet actif pour vous.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            placeholder="Symbol ou ISIN…"
            className="flex-1 px-3 py-2 rounded-md border border-input bg-card text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            autoFocus
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!isInputValid || state.status === "submitting"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.status === "submitting" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Charger
          </button>
        </form>

        {value && !isInputValid && (
          <p className="text-xs text-destructive mt-2">
            Format attendu&nbsp;: <span className="font-mono">SYMBOL.EXCHANGE</span> ou un ISIN de 12 caractères.
          </p>
        )}
      </motion.div>
    );
  }

  // ────────── État : polling (chargement en cours) ──────────
  if (state.status === "polling") {
    const progress = Math.min((state.elapsedSec / 60) * 100, 95);
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-popover text-popover-foreground border border-border rounded-xl"
      >
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="text-sm font-medium">
            Chargement de <span className="font-mono">{state.symbol}</span>…
          </p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Récupération des données depuis EODHD. Cela prend environ 30 secondes.
        </p>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 tabular-nums">
          {state.elapsedSec}s écoulées
        </p>
      </motion.div>
    );
  }

  // ────────── État : success ──────────
  if (state.status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-popover text-popover-foreground border border-success-200 dark:border-success-900 rounded-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2 className="w-5 h-5 text-success-600" />
          <p className="text-sm font-medium text-foreground">
            <span className="font-mono">{state.symbol}</span> chargé avec succès
          </p>
        </div>
        {state.name && (
          <p className="text-sm text-muted-foreground mb-4">{state.name}</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleNavigate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Voir la fiche
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNewSearch}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Nouvelle recherche
          </button>
        </div>
      </motion.div>
    );
  }

  // ────────── État : error ──────────
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-popover text-popover-foreground border border-destructive/40 rounded-xl"
    >
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <p className="text-sm font-medium text-foreground">
          {state.code === "not_found" ? "Symbol introuvable" : "Erreur de chargement"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{state.message}</p>
      <button
        type="button"
        onClick={handleNewSearch}
        className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
      >
        Réessayer
      </button>
    </motion.div>
  );
}