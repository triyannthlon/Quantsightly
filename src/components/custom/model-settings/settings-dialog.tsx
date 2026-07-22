"use client";

import type { ReactNode } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { FrostedDialogContent } from "@/components/custom/ui/frosted-dialog";
import { useTransitionWidth } from "@/hooks/model-settings/transition-context";

// Chaque quadrant s'étend de 0 à 100 depuis le centre. `transitionWidth` (T, 0-50)
// = directement le POURCENTAGE de chaque quadrant couvert par la zone neutre
// depuis les axes. On affiche donc T tel quel (0-50 %) : pas de conversion (T=50
// ne neutralise que la moitié de chaque quadrant, jamais la totalité).
const MARKER_20_LEFT = "40%"; // position de 20 sur l'échelle 0-50

/**
 * Fenêtre de réglage partagée (Régimes macro + 4 Quadrants) : largeur de la zone
 * neutre. `extra` = réglage(s) supplémentaire(s) propres à une page (ex. hypothèse
 * de coûts de l'onglet « 4Q vs Browne »), affichés sous un séparateur.
 */
export function ModelSettingsDialog({
  open,
  onOpenChange,
  extra,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  extra?: ReactNode;
}) {
  const { transitionWidth, setTransitionWidth } = useTransitionWidth();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FrostedDialogContent className="max-w-md">
        <DialogTitle>Réglages</DialogTitle>
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Largeur de la zone neutre</p>
            <span className="text-sm font-semibold tabular-nums">{transitionWidth} %</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={transitionWidth}
            onChange={(e) => setTransitionWidth(Number(e.target.value))}
            className="mt-2.5 h-1.5 w-full cursor-pointer accent-primary"
            aria-label="Largeur de la zone neutre"
          />
          <div className="relative mt-1.5 h-8 text-[11px] text-muted-foreground">
            <span className="absolute left-0 flex flex-col">
              <span>Plus réactive</span>
              <span className="tabular-nums">0 %</span>
            </span>
            <span className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: MARKER_20_LEFT }}>
              <span>Équilibrée</span>
              <span className="tabular-nums">20 %</span>
            </span>
            <span className="absolute right-0 flex flex-col items-end">
              <span>Plus stable</span>
              <span className="tabular-nums">50 %</span>
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Cette zone limite les changements d’allocation lorsque les signaux restent proches des axes.
          À 20 %, les 20 premiers pour cent de chaque quadrant sont considérés comme neutres. Une zone
          plus large rend l’allocation plus stable ; une zone plus étroite la rend plus réactive.
        </p>
        {extra && <div className="mt-5 border-t pt-4">{extra}</div>}
      </FrostedDialogContent>
    </Dialog>
  );
}
