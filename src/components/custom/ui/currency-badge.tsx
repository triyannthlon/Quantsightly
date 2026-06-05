"use client";

import { CURRENCY_FLAG } from "@/data/currencies";
import { CountryFlag } from "@/components/ui/CountryFlag";

interface CurrencyBadgeProps {
  code : string;
  label: string;
}

export function CurrencyBadge({ code, label }: CurrencyBadgeProps) {
  const flagCode = CURRENCY_FLAG[code];
  return (
    <span className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-2.5 py-1.5 text-sm">
      {flagCode && <CountryFlag code={flagCode} countryName={label} size={20} />}
      <span className="font-mono text-xs font-semibold">{code}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}