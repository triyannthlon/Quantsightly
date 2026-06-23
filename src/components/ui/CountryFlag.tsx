"use client";

import { cn } from "@/lib/utils";

interface CountryFlagProps {
  /** Code pays ISO 3166-1 alpha-2 : "US", "FR", "DE", "JP"… (accepte minuscules) */
  code: string;
  /** Taille en px (default 20) */
  size?: number;
  /** Nom du pays pour l'accessibilité */
  countryName?: string;
  className?: string;
}

export function CountryFlag({ code, size = 20, countryName, className }: CountryFlagProps) {
  if (!code) return null;

  const flagCode = code.toLowerCase().trim();

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/flags/${flagCode}.svg`}
      alt={countryName ?? code.toUpperCase()}
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0 rounded-full", className)}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
