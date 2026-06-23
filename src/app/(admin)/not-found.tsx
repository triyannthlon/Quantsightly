import Link from "next/link";
import { Compass, Home, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Page 404 du segment (admin).
 * Conserve le chrome de l'app (sidebar + header) grâce au layout parent.
 * Affiche le code 404 + un message rassurant + raccourcis vers les screeners.
 */
export default function AdminNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-8 py-12">
      <div className="flex flex-col items-center text-center max-w-lg">
        <div className="rounded-full bg-primary/10 p-5 mb-6">
          <Compass className="h-10 w-10 text-primary" />
        </div>

        <p className="text-5xl font-bold text-foreground tracking-tight mb-3 tabular-nums">404</p>

        <h1 className="text-xl font-semibold text-foreground mb-2">Page introuvable</h1>

        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          Cette page n&apos;existe pas ou a été déplacée. Reviens à l&apos;accueil ou explore
          directement l&apos;un des screeners.
        </p>

        <Button asChild className="gap-2 cursor-pointer mb-6">
          <Link href="/home">
            <Home className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>
        </Button>

        <div className="w-full pt-6 border-t border-border/60">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-3">
            Accès rapide aux screeners
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href="/screener/asset-stock" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Actions
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href="/screener/asset-etf" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                ETF
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href="/screener/asset-index" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Indices
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href="/screener/asset-crypto" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Cryptomonnaies
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <Link href="/screener/asset-currency" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Devises
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
