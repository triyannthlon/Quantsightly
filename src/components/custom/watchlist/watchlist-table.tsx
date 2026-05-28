"use client";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchlistRow } from "./watchlist-row";
import type { EnrichedWatchlistItem } from "@/lib/quantsightly/watchlist-client";

type Props = {
  items    : EnrichedWatchlistItem[];
  loading  : boolean;
  onRemoveAction : (itemId: string) => void;
};

export function WatchlistTable({ items, loading, onRemoveAction }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground border rounded-lg">
        <p className="text-sm font-medium">Aucun actif dans cette liste</p>
        <p className="text-xs mt-1">Cliquez sur « Rechercher » pour en ajouter.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14"></TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Devise</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <WatchlistRow key={item.id} item={item} onRemoveAction={onRemoveAction} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}