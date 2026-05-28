"use client";

import Image from "next/image";
import { MoreVertical, BarChart3, Trash2, LayoutDashboard } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { EnrichedWatchlistItem } from "@/lib/quantsightly/watchlist-client";

type Props = {
  item     : EnrichedWatchlistItem;
  onRemoveAction : (itemId: string) => void;
};

export function WatchlistRow({ item, onRemoveAction }: Props) {
  return (
    <TableRow className="group">
      {/* Drapeau pays */}
      <TableCell>
        {item.countryIso2 ? (
          <Image
            src={`/flags/${item.countryIso2.toLowerCase()}.svg`}
            alt={item.country ?? ""}
            width={20}
            height={15}
            className="rounded-[2px] object-cover"
          />
        ) : (
          <div className="w-5 h-3.75 rounded-[2px] bg-muted" />
        )}
      </TableCell>

      {/* Nom */}
      <TableCell className="font-medium">{item.name ?? item.symbol}</TableCell>

      {/* Symbol */}
      <TableCell className="font-mono text-sm text-muted-foreground">{item.symbol}</TableCell>

      {/* Type */}
      <TableCell className="text-sm text-muted-foreground">{item.assetTypeRaw ?? "—"}</TableCell>

      {/* Devise */}
      <TableCell className="text-sm text-muted-foreground">{item.currency ?? "—"}</TableCell>

      {/* Sous-menu */}
      <TableCell>
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
            <DropdownMenuItem disabled className="cursor-pointer">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Ajouter au dashboard
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