"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
    isFavorite: boolean;
    onToggleAction  : () => void;
};

export function FavoriteStar({ isFavorite, onToggleAction }: Props) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onToggleAction(); }}
            aria-label={isFavorite ? "Retirer du dashboard" : "Ajouter au dashboard"}
            className={cn(
                "shrink-0 flex items-center justify-center rounded transition-all duration-150",
                isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-60 hover:opacity-100!",
            )}
        >
            <Star
                className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    isFavorite
                        ? "fill-amber-400 text-amber-400"
                        : "fill-none text-muted-foreground hover:text-amber-400",
                )}
            />
        </button>
    );
}