"use client";

import { MoreVertical, BarChart3, Trash2, Star, ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WatchlistCellCtx, WatchlistColumnDef } from "./watchlist-table";

type Props<TRow> = {
  ctx: WatchlistCellCtx<TRow>;
  columns: WatchlistColumnDef<TRow>[];
  onRemoveAction: (itemId: string) => void;
  isExpanded?: boolean;

  onToggleExpandAction?: () => void;
};

export function WatchlistRow<TRow>({
  ctx,
  columns,
  onRemoveAction,
  isExpanded,
  onToggleExpandAction,
}: Props<TRow>) {
  const { item, onToggleFavorite } = ctx;

  return (
    <TableRow
      onClick={onToggleExpandAction}
      className={cn(
        "group transition-colors duration-150 hover:bg-muted/50",
        onToggleExpandAction && "cursor-pointer",
        item.isFavorite && "bg-amber-50/60 dark:bg-amber-500/5",
        isExpanded && "bg-primary/10 border-l-2 border-primary border-b-0",
      )}
    >
      {columns.map((col) => (
        <TableCell
          key={col.key}
          className={cn(
            "py-3",
            col.align === "right" && "text-right tabular-nums",
            col.align === "center" && "text-center",
            col.hideSm && "hidden md:table-cell",
          )}
        >
          {col.cell(ctx)}
        </TableCell>
      ))}

      <TableCell className="w-16">
        <div className="flex items-center justify-end gap-0.5">
          {onToggleExpandAction && (
            <ChevronRight
              className={cn(
                "h-5 w-5 shrink-0",
                "transition-[transform,opacity,color] duration-200",
                isExpanded
                  ? "text-primary opacity-100"
                  : "text-muted-foreground opacity-60 group-hover:opacity-100",
              )}
              style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
            />
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="cursor-pointer">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Visualiser
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={onToggleFavorite}>
                  <Star
                    className={cn(
                      "h-4 w-4 mr-2 transition-colors",
                      item.isFavorite ? "fill-amber-400 text-amber-400" : "",
                    )}
                  />
                  {item.isFavorite ? "Retirer du dashboard" : "Ajouter au dashboard"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => onRemoveAction(item.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Retirer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
