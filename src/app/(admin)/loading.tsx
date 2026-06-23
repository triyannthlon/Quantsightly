import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state automatique du segment (admin).
 * Affiché par Next.js pendant que les Server Components résolvent leurs await.
 *
 * Pattern volontairement neutre — marche aussi bien pour /home (grille de cards)
 * que pour /screener/* (table). La sidebar et le header restent visibles grâce
 * au layout parent.
 */
export default function AdminLoading() {
  return (
    <div className="px-8 py-6 space-y-6">
      {/* Header skeleton (titre + sous-titre + bouton éventuel) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Contenu skeleton — grille 3 colonnes qui matche dashboard et tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-4 border-b flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-7 w-14 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 py-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="rounded-lg border bg-card p-3 space-y-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
            <div className="px-4 pb-4 pt-1">
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
