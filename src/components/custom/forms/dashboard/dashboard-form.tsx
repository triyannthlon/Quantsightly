"use client";

import Link from "next/link";
import { Star, BarChart3 } from "lucide-react";
import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    closestCenter,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    arrayMove,
    rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AssetPanel } from "@/components/custom/asset-panel/asset-panel";
import { useDashboardFavorites, type DashboardFavorite } from "@/hooks/watchlist/use-dashboard-favorites";


// ── Carte sortable ─────────────────────────────────────────────

function SortableCard({
    favorite,
    onRemove,
}: {
    favorite: DashboardFavorite;
    onRemove: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: favorite.id });

    const style = {
        transform : CSS.Transform.toString(transform),
        transition,
        opacity   : isDragging ? 0.4 : 1,
        zIndex    : isDragging ? 10  : undefined,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <AssetPanel
                item={favorite}
                mode="card"
                assetType={favorite.assetType}
                onRemoveFavoriteAction={onRemove}
                dragHandleProps={{ ...attributes, ...listeners }}
            />
        </div>
    );
}


// ── États de chargement / vide ─────────────────────────────────

function LoadingGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card overflow-hidden">
                    <div className="px-4 py-4 border-b flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 px-4 py-3">
                        {Array.from({ length: 4 }).map((_, j) => (
                            <div key={j} className="rounded-lg border bg-card p-3 space-y-2">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        ))}
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-40 w-full rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
            <div className="rounded-full bg-amber-100 dark:bg-amber-500/10 p-4">
                <Star className="h-8 w-8 text-amber-400 fill-amber-400" />
            </div>
            <div className="space-y-1.5 max-w-sm">
                <p className="text-base font-semibold">Aucun favori pour l&apos;instant</p>
                <p className="text-sm text-muted-foreground">
                    Épinglez des actifs depuis le screener en cliquant sur l&apos;étoile
                    <Star className="inline h-3.5 w-3.5 mx-1 fill-amber-400 text-amber-400" />
                    pour les voir apparaître ici.
                </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="outline" size="sm" asChild>
                    <Link href="/screener/asset-stock"><BarChart3 className="h-3.5 w-3.5" />Actions</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/screener/asset-etf"><BarChart3 className="h-3.5 w-3.5" />ETF</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/screener/asset-crypto"><BarChart3 className="h-3.5 w-3.5" />Crypto</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/screener/asset-index"><BarChart3 className="h-3.5 w-3.5" />Indices</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/screener/asset-currency"><BarChart3 className="h-3.5 w-3.5" />Devises</Link>
                </Button>
            </div>
        </div>
    );
}


// ── Dashboard ──────────────────────────────────────────────────

export default function DashboardForm() {
    const { favorites, loading, error, reorder, removeFavorite } = useDashboardFavorites();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = favorites.findIndex(f => f.id === active.id);
        const newIndex = favorites.findIndex(f => f.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
            reorder(arrayMove(favorites, oldIndex, newIndex));
        }
    }

    return (
        <div className="px-8 py-6 space-y-6">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                {!loading && !error && (
                    <p className="text-sm text-muted-foreground mt-1 h-5">
                        {favorites.length === 0
                            ? "Aucun favori"
                            : `${favorites.length} actif${favorites.length > 1 ? "s" : ""} en suivi`}
                    </p>
                )}
            </div>

            {/* Contenu */}
            {error ? (
                <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
                    Erreur : {error}
                </div>
            ) : loading ? (
                <LoadingGrid />
            ) : favorites.length === 0 ? (
                <EmptyState />
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={favorites.map(f => f.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {favorites.map(fav => (
                                <SortableCard
                                    key={fav.id}
                                    favorite={fav}
                                    onRemove={() => void removeFavorite(fav)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

        </div>
    );
}
