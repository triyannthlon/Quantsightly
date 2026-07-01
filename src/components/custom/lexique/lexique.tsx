"use client";

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getGroupedGlossaryEntries } from "@/lib/glossary/glossary";

/**
 * Aide lexicale d'une page : un bouton (en-tête haut-droite) ouvre au clic un
 * panneau listant les mots-clés de la page, groupés par thème. Chaque entrée
 * montre son TITRE + sa définition COURTE (2-3 lignes) ; un clic déplie le
 * détail (un seul ouvert à la fois → le panneau reste court et lisible).
 */
export function Lexique({ terms, label = "Lexique" }: { terms: string[]; label?: string }) {
  const groups = getGroupedGlossaryEntries(terms);
  const [open, setOpen] = useState<string | null>(null);
  if (groups.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 cursor-pointer gap-1.5">
          <BookOpen className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Lexique de la page</p>
          <p className="text-xs text-muted-foreground">Cliquez un terme pour le détail.</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {groups.map((g) => (
            <section key={g.group}>
              <h3 className="sticky top-0 z-10 border-b bg-muted/60 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                {g.group}
              </h3>
              <div className="divide-y">
                {g.entries.map((e) => {
                  const isOpen = open === e.key;
                  return (
                    <div key={e.key}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : e.key)}
                        className="flex w-full cursor-pointer items-start justify-between gap-2 px-4 py-2 text-left hover:bg-muted/40"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{e.term}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {e.base}
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                      </button>

                      {isOpen && (
                        <div className="space-y-1.5 px-4 pb-2.5 text-xs text-muted-foreground/80">
                          {e.technique && <p className="leading-relaxed">{e.technique}</p>}
                          {(e.privilegier || e.reduire) && (
                            <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-0.5">
                              {e.privilegier && (
                                <>
                                  <span className="whitespace-nowrap font-medium text-foreground/70">
                                    À privilégier :
                                  </span>
                                  <span>{e.privilegier}</span>
                                </>
                              )}
                              {e.reduire && (
                                <>
                                  <span className="whitespace-nowrap font-medium text-foreground/70">
                                    À réduire :
                                  </span>
                                  <span>{e.reduire}</span>
                                </>
                              )}
                            </div>
                          )}
                          {e.exemple && <p className="italic">Exemples : {e.exemple}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
