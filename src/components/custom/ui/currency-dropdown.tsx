"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Currency, type CurrencyCode, CURRENCY_FLAG } from "@/data/currencies";

export type { Currency, CurrencyCode };

/******* CurrencyFlag *****/
function CurrencyFlag({ code, label }: { code: string; label: string }) {
  const flagCode = CURRENCY_FLAG[code];
  if (!flagCode) return null;
  return (
    <Image src={`/flags/${flagCode}.svg`} alt={label} width={20} height={15} className="shrink-0 rounded-[2px] object-cover" />
  );
}

export { CurrencyBadge } from "@/components/custom/ui/currency-badge";


export interface CurrencyDropdownProps {currencies  : Currency[];
                                 value      ?: CurrencyCode;
                                 onChange   ?: (currency: Currency) => void;
                                 className  ?: string;
                                 placeholder?: string;
                                 disabled   ?: boolean;}

/************** CurrencyDropdown *****/
export function CurrencyDropdown({ currencies, value, onChange, className, placeholder = "Sélectionner une devise", disabled = false }: CurrencyDropdownProps)
       {//CurrencyDropdown
       const selected = currencies.find((c) => c.code === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="outline" role="combobox" disabled={disabled} className={cn("w-64 justify-between font-normal cursor-pointer", className)}>
          {selected ? (
            <span className="flex items-center gap-2">
              <CurrencyFlag code={selected.code} label={selected.label} />
              <span className="font-mono text-xs font-semibold text-muted-foreground w-8 shrink-0">{selected.code}</span>
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64 p-0">
        <ScrollArea className="max-h-72">
          <div className="p-1">
            {currencies.map((currency) => (
              <DropdownMenuItem
                key={currency.code}
                onSelect={() => onChange?.(currency)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <CurrencyFlag code={currency.code} label={currency.label} />
                <span className="font-mono text-xs font-semibold text-muted-foreground w-8 shrink-0">{currency.code}</span>
                <span className="flex-1">{currency.label}</span>
                {selected?.code === currency.code && <CheckIcon className="size-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );

       }//CurrencyDropdown