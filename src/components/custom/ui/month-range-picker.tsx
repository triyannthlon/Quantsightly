"use client";

import * as React from "react";
import {
  format, startOfMonth, endOfMonth,
  isBefore, isAfter, isSameMonth,
} from "date-fns";
import { fr }                       from "date-fns/locale";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type DateRange }           from "react-day-picker";
import { cn }                       from "@/lib/utils";
import { Button }                   from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type { DateRange };

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2000, i, 1), "MMM", { locale: fr })
);

function getMonthState(
  year: number, monthIdx: number,
  value: DateRange | undefined,
): "start" | "end" | "middle" | "none" {
  const d = new Date(year, monthIdx, 1);
  if (value?.from && isSameMonth(d, value.from)) return "start";
  if (value?.to   && isSameMonth(d, value.to))   return "end";
  if (value?.from && value?.to) {
    const m = startOfMonth(d);
    if (!isBefore(m, startOfMonth(value.from)) && !isAfter(m, startOfMonth(value.to)))
      return "middle";
  }
  return "none";
}

interface MonthGridProps {
  year        : number;
  value       : DateRange | undefined;
  onMonthClick: (year: number, monthIdx: number) => void;
}

function MonthGrid({ year, value, onMonthClick }: MonthGridProps) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {MONTH_LABELS.map((label, idx) => {
        const state = getMonthState(year, idx, value);
        return (
          <button
            key={idx}
            onClick={() => onMonthClick(year, idx)}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer select-none",
              state === "none"   && "hover:bg-accent hover:text-accent-foreground",
              state === "middle" && "bg-accent text-accent-foreground rounded-none",
              (state === "start" || state === "end") &&
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface CalendarContentProps {
  value       : DateRange | undefined;
  displayYear : number;
  setDisplayYear: React.Dispatch<React.SetStateAction<number>>;
  onMonthClick: (year: number, monthIdx: number) => void;
}

function CalendarContent({ value, displayYear, setDisplayYear, onMonthClick }: CalendarContentProps) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" className="size-7 cursor-pointer"
          onClick={() => setDisplayYear(y => y - 1)}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium">{displayYear}</span>
        <Button variant="ghost" size="icon" className="size-7 cursor-pointer"
          onClick={() => setDisplayYear(y => y + 1)}>
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <MonthGrid year={displayYear} value={value} onMonthClick={onMonthClick} />
    </>
  );
}

interface MonthRangePickerProps {
  value?   : DateRange;
  onChange?: (range: DateRange | undefined) => void;
}

export function MonthRangePicker({ value, onChange }: MonthRangePickerProps) {
  const [displayYear, setDisplayYear] = React.useState(new Date().getFullYear() - 1);
  const [openFrom,    setOpenFrom   ] = React.useState(false);
  const [openTo,      setOpenTo     ] = React.useState(false);

  function handleFromClick(year: number, monthIdx: number) {
    const newFrom   = startOfMonth(new Date(year, monthIdx, 1));
    const currentTo = value?.to;
    if (currentTo && !isBefore(newFrom, startOfMonth(currentTo))) {
      onChange?.({ from: newFrom, to: undefined });
    } else {
      onChange?.({ from: newFrom, to: currentTo });
    }
    setOpenFrom(false);
  }

  function handleToClick(year: number, monthIdx: number) {
    const newTo       = endOfMonth(new Date(year, monthIdx, 1));
    const currentFrom = value?.from;
    if (currentFrom && isBefore(newTo, currentFrom)) {
      onChange?.({ from: undefined, to: newTo });
    } else {
      onChange?.({ from: currentFrom, to: newTo });
    }
    setOpenTo(false);
  }

  return (
    <div className="flex items-end gap-4">

      {/* Zone Date début */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Date début</p>
        <Popover open={openFrom} onOpenChange={setOpenFrom}>
          <PopoverTrigger asChild>
            <Button variant="outline"
              className={cn("w-36 justify-start font-normal cursor-pointer", !value?.from && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 size-4 shrink-0" />
              {value?.from ? format(value.from, "MMM yyyy", { locale: fr }) : "—"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <CalendarContent
              value={value} displayYear={displayYear} setDisplayYear={setDisplayYear}
              onMonthClick={handleFromClick}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Zone Date fin */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Date fin</p>
        <Popover open={openTo} onOpenChange={setOpenTo}>
          <PopoverTrigger asChild>
            <Button variant="outline"
              className={cn("w-36 justify-start font-normal cursor-pointer", !value?.to && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 size-4 shrink-0" />
              {value?.to ? format(value.to, "MMM yyyy", { locale: fr }) : "—"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <CalendarContent
              value={value} displayYear={displayYear} setDisplayYear={setDisplayYear}
              onMonthClick={handleToClick}
            />
          </PopoverContent>
        </Popover>
      </div>

    </div>
  );
}