// Encodage unique de l'état du Comparateur dans l'URL (deep-link).
//
// L'URL /exploration porte : a/b (séries), op (opération), curA/curB (devises),
// ma (moyenne mobile : N ans, ou 0 si masquée), from/to (plage, yyyy-MM-dd).
// Producteurs : bouton « Copier le lien » du Comparateur + lien « Ouvrir dans le
// comparateur » de Mes comparaisons. Lecteur : la page /exploration au montage.

import { parseISO } from "date-fns";
import type { OperationKind } from "@/lib/coredata/types";

const OPERATIONS: OperationKind[] = ["single", "overlay", "ratio", "difference"];

/** Forme brute des searchParams de /exploration. */
export interface ComparatorSearchParams {
  a?: string;
  b?: string;
  op?: string;
  curA?: string;
  curB?: string;
  ma?: string;
  from?: string;
  to?: string;
}

/** État (partiel) suffisant pour construire un lien de comparaison. */
export interface ComparatorLinkConfig {
  serieAId: string;
  serieBId?: string;
  operation: OperationKind;
  currencyA?: string;
  currencyB?: string;
  showMA?: boolean;
  maYears?: number;
  from?: string;
  to?: string;
}

/** Construit le href /exploration?… restaurant la vue à l'identique. */
export function comparatorHref(c: ComparatorLinkConfig): string {
  const p = new URLSearchParams();
  p.set("a", c.serieAId);
  if (c.serieBId) p.set("b", c.serieBId);
  p.set("op", c.operation);
  if (c.currencyA) p.set("curA", c.currencyA);
  if (c.currencyB) p.set("curB", c.currencyB);
  // Moyenne mobile : 0 = masquée ; sinon le nombre d'années.
  if (c.showMA === false) p.set("ma", "0");
  else if (c.maYears != null) p.set("ma", String(c.maYears));
  if (c.from) p.set("from", c.from);
  if (c.to) p.set("to", c.to);
  return `/exploration?${p.toString()}`;
}

/** Réglages de vue interprétés depuis l'URL (hors séries a/b, résolues ailleurs). */
export interface ParsedComparatorView {
  operation?: OperationKind;
  currencyA?: string;
  currencyB?: string;
  showMA?: boolean;
  maYears?: number;
  from?: Date;
  to?: Date;
}

/** Interprète les searchParams bruts en réglages de vue typés. */
export function parseComparatorView(sp: ComparatorSearchParams): ParsedComparatorView {
  const v: ParsedComparatorView = {};
  if (sp.op && OPERATIONS.includes(sp.op as OperationKind)) v.operation = sp.op as OperationKind;
  if (sp.curA) v.currencyA = sp.curA;
  if (sp.curB) v.currencyB = sp.curB;
  if (sp.ma != null && sp.ma !== "") {
    const n = Number(sp.ma);
    if (Number.isFinite(n)) {
      if (n <= 0) v.showMA = false;
      else {
        v.showMA = true;
        v.maYears = Math.min(20, Math.max(1, Math.round(n)));
      }
    }
  }
  if (sp.from) {
    const d = parseISO(sp.from);
    if (!isNaN(d.getTime())) v.from = d;
  }
  if (sp.to) {
    const d = parseISO(sp.to);
    if (!isNaN(d.getTime())) v.to = d;
  }
  return v;
}
