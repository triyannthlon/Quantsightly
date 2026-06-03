import { Building2, Layers, CandlestickChart, Bitcoin, Banknote, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssetKind = "stock" | "etf" | "index" | "crypto" | "forex";

/** Déduit le type d'actif depuis l'exchange / le type EODHD. */
export function assetKind(exchangeCode?: string | null, typeRaw?: string | null): AssetKind {
    if (exchangeCode === "CC")    return "crypto";
    if (exchangeCode === "FOREX") return "forex";
    if (exchangeCode === "INDX" || typeRaw === "INDEX") return "index";
    if (typeRaw === "ETF")        return "etf";
    return "stock";
}

/** Vrai uniquement pour les types qui ont un pays (stock / ETF). */
export function hasCountry(kind: AssetKind): boolean {
    return kind === "stock" || kind === "etf";
}

const MAP: Record<AssetKind, { Icon: LucideIcon; cls: string }> = {
    stock : { Icon: Building2,        cls: "bg-blue-100   text-blue-600   dark:bg-blue-500/15   dark:text-blue-400"   },
    etf   : { Icon: Layers,           cls: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
    index : { Icon: CandlestickChart, cls: "bg-amber-100  text-amber-600  dark:bg-amber-500/15  dark:text-amber-400"  },
    crypto: { Icon: Bitcoin,          cls: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400" },
    forex : { Icon: Banknote,         cls: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
};

type Props = {
    exchangeCode?: string | null;
    typeRaw     ?: string | null;
    kind        ?: AssetKind;       // type direct (prioritaire) — ex. en-tête de page
    size        ?: number;
};

/**
 * Pastille ronde colorée + icône, propre à chaque type d'actif.
 * - fallback logo dans les listes (crypto/forex/index n'ont pas de logo),
 * - ou en-tête de page via `kind`.
 */
export function AssetTypeIcon({ exchangeCode, typeRaw, kind, size = 28 }: Props) {
    const { Icon, cls } = MAP[kind ?? assetKind(exchangeCode, typeRaw)];
    const iconSize = Math.round(size * 0.57);

    return (
        <span
            className={cn("flex items-center justify-center rounded-full shrink-0", cls)}
            style={{ width: size, height: size }}
        >
            <Icon size={iconSize} />
        </span>
    );
}
