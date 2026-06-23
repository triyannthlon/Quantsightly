"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCw, Home } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

/**
 * Error boundary du segment (admin).
 * Capture tout crash dans /home, /screener/*, etc.
 *
 * Next.js fournit `reset()` qui re-render la sous-arbre — utile quand l'erreur
 * est transitoire (DB momentanément down, API C++ qui revient). En dev on
 * affiche le détail technique pour debugger ; en prod on reste sobre.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hook d'observabilité — à brancher sur Sentry quand on l'installera.
    console.error("[admin/error]", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-8 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-col items-center text-center max-w-md"
      >
        <div className="rounded-full bg-destructive/10 p-5 mb-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Une erreur est survenue</h1>

        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          Impossible d&apos;afficher cette page pour le moment. Cela peut être dû à un problème
          temporaire de connexion ou de chargement de données.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button onClick={reset} className="gap-2 cursor-pointer">
            <RotateCw className="h-4 w-4" />
            Réessayer
          </Button>
          <Button variant="outline" asChild className="cursor-pointer">
            <Link href="/home" className="gap-2">
              <Home className="h-4 w-4" />
              Retour à l&apos;accueil
            </Link>
          </Button>
        </div>

        {isDev && error.message && (
          <details className="mt-10 w-full text-left bg-muted/40 border border-border/60 rounded-lg overflow-hidden">
            <summary className="cursor-pointer text-xs font-mono text-muted-foreground px-4 py-2 hover:bg-muted/60 transition-colors">
              Détails techniques (visible en dev uniquement)
            </summary>
            <div className="px-4 py-3 border-t border-border/60">
              <p className="text-xs font-mono text-foreground break-all">{error.message}</p>
              {error.digest && (
                <p className="text-[11px] font-mono text-muted-foreground mt-2">
                  digest: {error.digest}
                </p>
              )}
            </div>
          </details>
        )}
      </motion.div>
    </div>
  );
}
