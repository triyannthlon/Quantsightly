"use client";

import * as React from "react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Country, type CountryCode } from "@/data/countries";

export type { Country, CountryCode };

interface CountryDropdownProps {
  countries: Country[];
  value?: CountryCode;
  onChange?: (country: Country) => void;
  className?: string;
  placeholder?: string;
}

/************** CountryDropdown *****/
export function CountryDropdown({
  countries,
  value,
  onChange,
  className,
  placeholder = "Sélectionner un pays",
}: CountryDropdownProps) {
  const selected = countries.find((c) => c.code === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-52 justify-between font-normal cursor-pointer", className)}
        >
          {selected ? (
            <span className="flex items-center gap-2">
              <CountryFlag code={selected.code} countryName={selected.label} size={20} />
              <span>{selected.label}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52 p-0">
        <ScrollArea className="max-h-72">
          <div className="p-1">
            {countries.map((country) => (
              <DropdownMenuItem
                key={country.code}
                onSelect={() => onChange?.(country)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <CountryFlag code={country.code} countryName={country.label} size={20} />
                <span className="flex-1">{country.label}</span>
                {selected?.code === country.code && <CheckIcon className="size-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} ////CountryDropdown
