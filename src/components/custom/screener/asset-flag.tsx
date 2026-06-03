"use client";

import Image from "next/image";
import { Coins, ChartLine, ArrowRight } from "lucide-react";
import { CURRENCY_FLAG } from "@/data/currencies";

type Props = {
    countryIso2 ?: string | null;
    exchangeCode?: string | null;
    code        ?: string | null;   // ex: "EURUSD", "AED", "BTC-USD"
};

/* Pour une paire FOREX : drapeau base → flèche → drapeau quote */
export function ForexPairFlags({ code }: { code: string }) {
    let base  = "";
    let quote = "";

    if (code.length === 3) {            // "AED" = USD/AED (USD implicite)
        base  = "USD";
        quote = code;
    } else if (code.length === 6) {     // "EURUSD" = EUR/USD
        base  = code.substring(0, 3);
        quote = code.substring(3, 6);
    } else {
        return <div className="w-5 h-3.75 rounded-[2px] bg-muted" />;
    }

    const baseFlag  = CURRENCY_FLAG[base];
    const quoteFlag = CURRENCY_FLAG[quote];

    return (
        <div className="flex items-center gap-1">
            {baseFlag ? (
                <Image src={`/flags/${baseFlag}.svg`} alt={base} width={18} height={13} className="rounded-[2px] object-cover" />
            ) : (
                <div className="w-4.5 h-3.25 rounded-[2px] bg-muted" />
            )}

            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />

            {quoteFlag ? (
                <Image src={`/flags/${quoteFlag}.svg`} alt={quote} width={18} height={13} className="rounded-[2px] object-cover" />
            ) : (
                <div className="w-4.5 h-3.25 rounded-[2px] bg-muted" />
            )}
        </div>
    );
}

export function AssetFlag({ countryIso2, exchangeCode, code }: Props) {
    // 1. Crypto → icône
    if (exchangeCode === "CC") {
        return (
            <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Coins className="w-3 h-3 text-orange-600 dark:text-orange-400" />
            </div>
        );
    }

    // 2. FOREX → 2 mini-drapeaux devises
    if (exchangeCode === "FOREX" && code) {
        return <ForexPairFlags code={code} />;
    }

    // 3. Indice (INDX) → icône graphique (pas de drapeau fiable via l'exchange virtuel)
    if (exchangeCode === "INDX") {
        return (
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ChartLine className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            </div>
        );
    }

    // 4. Action / ETF → drapeau pays
    if (countryIso2) {
        return (
            <Image
                src={`/flags/${countryIso2.toLowerCase()}.svg`}
                alt=""
                width={20}
                height={15}
                className="rounded-[2px] object-cover"
            />
        );
    }

    // 4. Fallback
    return <div className="w-5 h-3.75 rounded-[2px] bg-muted" />;
}