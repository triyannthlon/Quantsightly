"use client";

import React, { useState } from "react";
import { AssetPanel } from "@/components/custom/asset-panel/asset-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EnrichedWatchlistItem } from "@/lib/yann/watchlist/clients/watchlist-client";
import { cn } from "@/lib/utils";

const FAKE_ITEMS: EnrichedWatchlistItem[] = [
    { id: "1", symbol: "AAPL.US",   positionRank: 1, isFavorite: true,  addedAt: "2024-01-01", name: "Apple Inc.",     currency: "USD", country: "United States" },
    { id: "2", symbol: "MSFT.US",   positionRank: 2, isFavorite: true,  addedAt: "2024-01-01", name: "Microsoft Corp.", currency: "USD", country: "United States" },
    { id: "3", symbol: "NVDA.US",   positionRank: 3, isFavorite: false, addedAt: "2024-01-01", name: "NVIDIA Corp.",    currency: "USD", country: "United States" },
    { id: "4", symbol: "BTC-USD.CC",positionRank: 4, isFavorite: false, addedAt: "2024-01-01", name: "Bitcoin",         currency: "USD" },
];

export default function AssetPanelDemoPage() {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <div className="px-8 py-8 space-y-10 max-w-5xl mx-auto">

            <div>
                <h1 className="text-xl font-bold mb-1">AssetPanel — démo</h1>
                <p className="text-sm text-muted-foreground">Cliquez sur une ligne pour ouvrir le panel.</p>
            </div>

            {/* Mode inline — accordion dans une vraie table */}
            <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Mode inline (screener accordion)
                </h2>
                <div className="rounded-lg border overflow-hidden bg-card">
                    <Table className="table-fixed w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">Nom</TableHead>
                                <TableHead>Symbole</TableHead>
                                <TableHead className="text-right">Dernier prix</TableHead>
                                <TableHead className="text-right">1J</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {FAKE_ITEMS.map((item) => (
                                <React.Fragment key={item.id}>
                                    <TableRow
                                        onClick={() => setExpandedId(id => id === item.id ? null : item.id)}
                                        className={cn(
                                            "cursor-pointer group",
                                            item.isFavorite && "bg-amber-50/60 dark:bg-amber-500/5",
                                            expandedId === item.id && "bg-muted/40 border-b-0",
                                        )}
                                    >
                                        <TableCell className="font-semibold">{item.name}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{item.symbol}</TableCell>
                                        <TableCell className="text-right tabular-nums">—</TableCell>
                                        <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                                    </TableRow>
                                    {expandedId === item.id && (
                                        <TableRow className="hover:bg-transparent border-b-0">
                                            <TableCell colSpan={4} className="p-0">
                                                <AssetPanel
                                                    item={item}
                                                    mode="inline"
                                                    onCloseAction={() => setExpandedId(null)}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </section>

            {/* Mode card — dashboard */}
            <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Mode card (dashboard favoris)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {FAKE_ITEMS.filter(i => i.isFavorite).map((item) => (
                        <AssetPanel
                            key={item.id}
                            item={item}
                            mode="card"
                            onRemoveFavoriteAction={() => console.log("remove", item.symbol)}
                        />
                    ))}
                </div>
            </section>

        </div>
    );
}
