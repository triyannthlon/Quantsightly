"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { FrostedDialogContent } from "@/components/custom/ui/frosted-dialog";

/**
 * Bouton « Agrandir » + dialogue de zoom, pour les visuels dont on ne peut pas
 * envelopper le tracé dans un bouton (nuages / matrices : les pastilles pays sont
 * déjà des boutons cliquables → boutons imbriqués interdits).
 *
 * `children` reçoit une fonction `close` pour refermer le dialogue après un clic
 * (ex. sélection d'un pays qui ouvre sa vue détaillée). La version agrandie n'est
 * montée que lorsque le dialogue est ouvert (Radix démonte le contenu à la fermeture).
 */
export function ZoomableSection({
  title,
  className,
  children,
}: {
  title: string;
  /** Classes appliquées au bouton déclencheur (ex. `ml-auto` pour le pousser à droite). */
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Agrandir"
        title="Agrandir"
        className={cn(
          "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
      >
        <Maximize2 className="size-3.5" />
        Agrandir
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <FrostedDialogContent
          className="max-h-[92vh] w-[92vw] max-w-[92vw] overflow-y-auto sm:max-w-[92vw]"
          showCloseButton
        >
          <DialogTitle className="text-center text-base font-medium">{title}</DialogTitle>
          {children(() => setOpen(false))}
        </FrostedDialogContent>
      </Dialog>
    </>
  );
}
