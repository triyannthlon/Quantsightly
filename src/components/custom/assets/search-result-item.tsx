"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2, BarChart3, Coins, TrendingUp } from "lucide-react";
import { buildLogoUrlFromSymbol } from "@/lib/quantsightly/detect-input-format";
import type { SearchResult } from "@/lib/quantsightly/types";

type Props = {
    result: SearchResult;
    isHighlighted: boolean;
    onClickAction: () => void;
    onMouseEnterAction: () => void;
};

function TypeIcon({ type, className }: { type: string; className?: string }) {
    const t = type.toLowerCase();
    if (t.includes("etf") || t.includes("fund")) return <BarChart3 className={className} />;
    if (t.includes("currency") || t.includes("forex") || t.includes("crypto")) return <Coins className={className} />;
    if (t.includes("index")) return <TrendingUp className={className} />;
    return <Building2 className={className} />;
}

function getTypeBadge(type: string) {
    const t = type.toLowerCase();
    if (t === "etf" || t === "fund")
        return "bg-blue-light-100 text-blue-light-700 dark:bg-blue-light-900/30 dark:text-blue-light-300";
    if (t === "forex" || t === "currency" || t === "crypto")
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    if (t === "index")
        return "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300";
    return "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300";
}

function getMatchedViaLabel(matchedVia: string) {
    switch (matchedVia.toLowerCase()) {
        case "isin"       : return "ISIN";
        case "symbol"     : return "Symbol";
        case "name"       : return "Nom";
        case "short_name" : return "Nom court";
        case "sector"     : return "Secteur";
        default           : return matchedVia;
    }
}

export function SearchResultItem({ result, isHighlighted, onClickAction, onMouseEnterAction }: Props) {
    // URL en erreur plutôt qu'un booléen : se réinitialise automatiquement
    // quand result change de slot (logoUrl change → logoError = false sans useEffect).
    const [errorLogoUrl, setErrorLogoUrl] = useState<string | null>(null);
    const badgeClass = getTypeBadge(result.type);
    const logoUrl = buildLogoUrlFromSymbol(result.primary_symbol);
    const logoError = errorLogoUrl === logoUrl;
    const hasLogo = logoUrl !== "" && !logoError;

    return (
        <button
            type="button"
            onClick={onClickAction}
            onMouseEnter={onMouseEnterAction}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
            }`}
        >
            {/* Logo */}
            <div className="shrink-0 w-9 h-9 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                {hasLogo ? (
                    <Image
                        src={logoUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="w-full h-full object-contain"
                        onError={() => setErrorLogoUrl(logoUrl)}
                        unoptimized
                    />
                ) : (
                    <TypeIcon type={result.type} className="w-5 h-5 text-muted-foreground" />
                )}
            </div>

            {/* Nom + type + identifiants */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{result.name}</span>
                    <span
                        className={`shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${badgeClass}`}
                    >
            {result.type}
          </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {result.primary_symbol && (
                        <span className="font-mono">{result.primary_symbol}</span>
                    )}
                    {result.domicile && <span>· {result.domicile}</span>}
                    {result.isin && <span>· {result.isin}</span>}
                    {result.sector && <span>· {result.sector}</span>}
                </div>
            </div>

            {/* Matched via (petit badge à droite) */}
            <div className="shrink-0 text-right">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          {getMatchedViaLabel(result.matched_via)}
        </span>
            </div>
        </button>
    );
}