"use client";

import Image from "next/image";
import { CURRENCY_FLAG } from "@/data/currencies";

interface CurrencyBadgeProps {
  code : string;
  label: string;
}

export function CurrencyBadge({ code, label }: CurrencyBadgeProps) {
  const flagCode = CURRENCY_FLAG[code];
  return (
    <span className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-2.5 py-1.5 text-sm">
      {flagCode && (
        <Image src={`/flags/${flagCode}.svg`} alt={label} width={20} height={15} className="shrink-0 rounded-[2px] object-cover" />
      )}
      <span className="font-mono text-xs font-semibold">{code}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}