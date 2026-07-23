"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * Coquille de navigation des pages Modèles (Browne, 4 Quadrants).
 *
 * Trois états, sans saut de mise en page :
 *  1. **Paramètres complets** dans la page + navigation interne visible dessous ;
 *  2. au scroll, la barre (résumé compact + navigation) se **fige** sous les onglets ;
 *  3. depuis la barre figée, « Modifier » **déplie** les contrôles complets, qui
 *     poussent le contenu vers le bas (ils ne le recouvrent pas).
 *
 * La barre est **dans le flux** (sticky) : toujours présente, de hauteur constante
 * entre les états 1 et 2 (donc pas d'apparition brutale), elle grandit seulement
 * au dépliage. Un scrollspy suit la section visible et met à jour le hash.
 */

export interface StickyTab {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean;
}

export interface StickyNavSection {
  id: string;
  label: string;
}

export interface StickySummaryItem {
  label: string;
  value: string;
}

interface Props {
  tabs: StickyTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  /** Élément additionnel en fin de rangée d'onglets (ex. bouton Réglages). */
  headerExtra?: React.ReactNode;
  /** Affiche la barre de paramètres (false sur une page de doc). */
  showParams: boolean;
  /** Contrôles complets (grille de SelectDropdown) — rendus dans le bloc initial et le panneau déplié. */
  renderControls: () => React.ReactNode;
  /** Valeurs actives résumées dans la barre compacte. */
  summary: StickySummaryItem[];
  /** Sections de l'onglet actif (navigation interne). */
  sections: StickyNavSection[];
  /** Recalcul en cours (spinner dans la barre compacte). */
  loading?: boolean;
  children: React.ReactNode;
}

export function ModelStickyControls({
  tabs,
  activeTab,
  onTabChange,
  headerExtra,
  showParams,
  renderControls,
  summary,
  sections,
  loading,
  children,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // Instant (ms) jusqu'auquel le scrollspy ne réécrit pas la section active
  // (le temps du défilement animé déclenché par un clic sur un raccourci).
  const spyLockUntil = useRef(0);
  // Saute le premier passage de l'effet « retour en haut au changement d'onglet »
  // (au montage on ne veut pas contrarier un éventuel hash de deep-link).
  const tabMountRef = useRef(false);

  const [stuck, setStuck] = useState(false); // onglets épinglés
  const [condensed, setCondensed] = useState(false); // barre épinglée → résumé compact
  const [expanded, setExpanded] = useState(false); // paramètres dépliés
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  const getRoot = useCallback(() => rootRef.current?.closest("main") as HTMLElement | null, []);

  // Referme les paramètres dépliés dès que la barre n'est plus condensée.
  useEffect(() => {
    if (!condensed) setExpanded(false);
  }, [condensed]);

  // Hauteur des onglets → variable `--tabs-h` (position sticky d'accroche de la barre).
  useEffect(() => {
    const el = tabsRef.current;
    const host = rootRef.current;
    if (!el || !host) return;
    const apply = () =>
      host.style.setProperty("--tabs-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll : états épinglés + offset des ancres + scrollspy.
  useEffect(() => {
    const root = getRoot();
    if (!root) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const rootTop = root.getBoundingClientRect().top;
      const tabsH = tabsRef.current?.getBoundingClientRect().height ?? 0;
      const barBox = barRef.current?.getBoundingClientRect();
      const barH = barBox?.height ?? 0;

      setStuck((tabsRef.current?.getBoundingClientRect().top ?? Infinity) <= rootTop + 0.5);
      setCondensed((barBox?.top ?? Infinity) <= rootTop + tabsH + 0.5);

      // Offset des ancres = hauteur totale des éléments sticky (onglets + barre, panneau déplié inclus).
      const offset = tabsH + barH + 12;
      contentRef.current?.style.setProperty("--model-header-offset", `${Math.round(offset)}px`);

      // Section active : la dernière dont le haut a franchi la ligne (sous la barre).
      // On n'écrase pas la sélection tant que le défilement animé d'un clic est en cours.
      if (sections.length && Date.now() >= spyLockUntil.current) {
        const line = rootTop + offset + 4; // tolérance : arrondis / sous-pixels
        let current = sections[0].id;
        for (const s of sections) {
          const node = document.getElementById(s.id);
          if (!node) continue;
          if (node.getBoundingClientRect().top <= line) current = s.id;
          else break;
        }
        setActiveId(current);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    root.addEventListener("scroll", schedule, { passive: true });
    measure();
    // Re-mesure quand la barre (dépliage) ou le contenu changent de hauteur.
    const ro = new ResizeObserver(schedule);
    if (barRef.current) ro.observe(barRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => {
      root.removeEventListener("scroll", schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [getRoot, sections]);

  // Deep-link : au montage, si l'URL porte un hash de section, on s'y positionne.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash && sections.some((s) => s.id === hash)) {
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
    }
    // Au montage uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changement d'onglet : le contenu du nouvel onglet doit s'afficher depuis le
  // début, pas à la position de défilement héritée de l'onglet précédent. On
  // ramène donc le conteneur en haut et on retire le hash de section (celui de
  // l'onglet quitté n'a plus de sens). Le montage est ignoré (deep-link).
  useEffect(() => {
    if (!tabMountRef.current) {
      tabMountRef.current = true;
      return;
    }
    spyLockUntil.current = 0;
    getRoot()?.scrollTo({ top: 0 });
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [activeTab, getRoot]);

  // Nouvel onglet (nouvelles sections) → la 1ʳᵉ pastille redevient active.
  useEffect(() => {
    setActiveId(sections[0]?.id ?? null);
  }, [sections]);

  // L'onglet de section actif reste visible dans la nav (défilement HORIZONTAL interne
  // uniquement — n'affecte pas le défilement de la page). Garantit la visibilité du
  // dernier onglet quand la liste déborde.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !activeId) return;
    const pill = nav.querySelector<HTMLElement>(`[data-section="${CSS.escape(activeId)}"]`);
    if (!pill) return;
    const navBox = nav.getBoundingClientRect();
    const pillBox = pill.getBoundingClientRect();
    if (pillBox.left < navBox.left + 8) {
      nav.scrollBy({ left: pillBox.left - navBox.left - 12, behavior: "smooth" });
    } else if (pillBox.right > navBox.right - 8) {
      nav.scrollBy({ left: pillBox.right - navBox.right + 12, behavior: "smooth" });
    }
  }, [activeId]);

  const goToSection = useCallback(
    (id: string, index: number) => {
      // Verrouille le scrollspy le temps du défilement animé (sinon il réécrit
      // la section active pendant le mouvement).
      spyLockUntil.current = Date.now() + 800;
      // Première section → retour tout en haut (feuille affichée normalement,
      // barre non condensée) plutôt qu'un ancrage à mi-page.
      if (index === 0) {
        getRoot()?.scrollTo({ top: 0, behavior: "smooth" });
        setActiveId(id);
        history.replaceState(null, "", window.location.pathname + window.location.search);
        return;
      }
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
      history.replaceState(null, "", `#${id}`);
    },
    [getRoot],
  );

  const hasBar = showParams || sections.length > 0;

  return (
    <div ref={rootRef} className="space-y-4">
      {/* Onglets — sticky ; ombre de séparation seulement une fois épinglés. */}
      <div
        ref={tabsRef}
        className={cn(
          "sticky top-0 z-30 -mx-6 bg-background px-6 transition-shadow",
          stuck && "shadow-[0_2px_4px_-2px_rgb(0_0_0/0.18)]",
        )}
      >
        <nav className="flex flex-wrap items-center gap-1 border-b border-border/60">
          {tabs.map((t) => {
            const active = t.key === activeTab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onTabChange(t.key)}
                className={cn(
                  "relative -mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className={cn("size-4", active ? "text-primary" : "opacity-70")} />
                {t.label}
                {!t.ready && (
                  <span className="ml-0.5 rounded bg-muted px-1 py-px text-[9px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                    bientôt
                  </span>
                )}
              </button>
            );
          })}
          {headerExtra}
        </nav>
      </div>

      {/* État 1 — bloc initial de paramètres (dans le flux, défile normalement). */}
      {showParams && <Card className="p-3">{renderControls()}</Card>}

      {/* Barre : navigation (toujours visible) + résumé compact (une fois condensée)
          + paramètres dépliés (poussent le contenu vers le bas). Dans le flux → pas
          d'apparition brutale, pas de recouvrement. */}
      {hasBar && (
        <div
          ref={barRef}
          style={{ top: "var(--tabs-h, 44px)" }}
          className={cn(
            "sticky z-20 -mx-6 bg-background px-6 transition-shadow",
            condensed && "shadow-[0_6px_12px_-6px_rgb(0_0_0/0.28)]",
          )}
        >
          {/* Une seule ligne compacte : résumé (largeur fixe) à gauche, navigation
              (flexible, scrollable) à droite. Jamais de retour à la ligne. */}
          <div className="flex flex-nowrap items-center gap-3 py-2">
            {/* Résumé des valeurs actives + Modifier — `shrink-0` (ne se fait pas
                écraser par la nav), troncature interne bornée. Visible une fois condensée. */}
            {showParams && condensed && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  className="inline-flex max-w-[13rem] cursor-pointer items-center gap-2 rounded-md border border-foreground/20 bg-background/60 px-2.5 py-1 text-xs hover:border-foreground/40 sm:max-w-[22rem]"
                >
                  <SlidersHorizontal className="size-3.5 shrink-0 opacity-70" />
                  <span
                    className="truncate text-muted-foreground"
                    title={summary.map((s) => `${s.label} : ${s.value}`).join(" · ")}
                  >
                    {summary.map((s) => s.value).join("  ·  ")}
                  </span>
                  <span className="shrink-0 font-medium text-foreground">
                    {expanded ? "Fermer" : "Modifier"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {loading && (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                )}
              </div>
            )}

            {/* Séparateur discret entre résumé et navigation. */}
            {showParams && condensed && sections.length > 0 && (
              <div aria-hidden className="h-5 w-px shrink-0 bg-border/60" />
            )}

            {/* Navigation interne — prend l'espace restant, défile horizontalement (jamais
                sur 2 lignes) ; l'onglet actif est ramené dans la vue (voir l'effet dédié). */}
            {sections.length > 0 && (
              <nav
                ref={navRef}
                className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {sections.map((s, index) => {
                  const active = activeId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-section={s.id}
                      onClick={() => goToSection(s.id, index)}
                      className={cn(
                        "shrink-0 cursor-pointer rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                        active
                          ? "border-primary bg-primary/20 text-foreground ring-1 ring-primary/30"
                          : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

          {/* État 3 — paramètres dépliés : dans le flux, ils repoussent le contenu. */}
          {showParams && expanded && (
            <div className="border-t border-border/50 py-3">{renderControls()}</div>
          )}
        </div>
      )}

      {/* Contenu de l'onglet (porte la variable d'offset pour les ancres). */}
      <div ref={contentRef} className="space-y-4">
        {children}
      </div>
    </div>
  );
}
