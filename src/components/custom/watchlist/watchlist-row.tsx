"use client";

import { MoreVertical, BarChart3, Trash2, Star } from "lucide-react";
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
    ctx             : WatchlistCellCtx<TRow>;
    columns         : WatchlistColumnDef<TRow>[];
    onRemoveAction  : (itemId: string) => void;
    isExpanded     ?: boolean;
    onToggleExpand ?: () => void;
};


export function WatchlistRow<TRow>({ ctx, columns, onRemoveAction, isExpanded, onToggleExpand }: Props<TRow>) {

    const { item, onToggleFavorite } = ctx;

    return (
        <TableRow
            onClick={onToggleExpand}
            className={cn(
                "group",
                onToggleExpand  && "cursor-pointer",
                item.isFavorite && "bg-amber-50/60 dark:bg-amber-500/5",
                isExpanded      && "bg-muted/40 border-b-0",
            )}
        >
            {columns.map((col) => (
                <TableCell
                    key={col.key}
                    className={cn(
                        col.align === "right" && "text-right tabular-nums",
                        col.hideSm           && "hidden md:table-cell",
                    )}
                >
                    {col.cell(ctx)}
                </TableCell>
            ))}

            <TableCell onClick={(e) => e.stopPropagation()}>
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
                        <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={onToggleFavorite}
                        >
                            <Star className={cn(
                                "h-4 w-4 mr-2 transition-colors",
                                item.isFavorite ? "fill-amber-400 text-amber-400" : "",
                            )} />
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
            </TableCell>
        </TableRow>
    );
}