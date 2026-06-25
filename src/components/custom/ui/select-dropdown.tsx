"use client";

import * as React from "react";
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

/* ----- Types -----*/

export interface SelectItem {
  value: string;
  label: string;
  /** Élément optionnel affiché avant le libellé (drapeau, symbole…). */
  icon?: React.ReactNode;
}

/******** SelectDropdownProps *****/
interface SelectDropdownProps {
  items: SelectItem[];
  value?: string;
  onChange?: (item: SelectItem) => void;
  className?: string;
  placeholder?: string;
  width?: string; /* ex: "w-52", "w-72" — défaut : "w-52"             */
  maxHeight?: string;
} /* ex: "max-h-48", "max-h-96" — défaut : "max-h-72" */

/************** SelectDropdown *****/
export function SelectDropdown({
  items,
  value,
  onChange,
  className,
  placeholder = "Sélectionner",
  width = "w-52",
  maxHeight = "max-h-72",
}: SelectDropdownProps) {
  const selected = items.find((i) => i.value === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            width,
            "justify-between font-normal cursor-pointer border-foreground/25 bg-background/60 hover:border-foreground/40",
            className,
          )}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              {selected.icon}
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          {/* Chevron : suit la couleur du texte (plein si valeur, atténué si placeholder). */}
          <ChevronDownIcon
            className={cn("ml-auto size-4 shrink-0", !selected && "text-muted-foreground")}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className={cn(width, "p-0")}>
        <ScrollArea className={maxHeight}>
          <div className="p-1">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.value}
                onSelect={() => onChange?.(item)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {selected?.value === item.value && <CheckIcon className="size-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
