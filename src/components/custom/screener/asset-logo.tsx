"use client";

import { useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  logoUrl?: string;
  fallback: ReactNode; // affiché si pas de logo ou erreur de chargement
  size?: number;
};

/**
 * Logo société (EODHD), centré dans une pastille ronde.
 * - Fond clair : beaucoup de logos sont des PNG transparents à glyphe sombre,
 *   invisibles sinon en dark mode. Le fond garantit la lisibilité partout.
 * - `object-contain` + flex centre le logo quel que soit son ratio.
 * - 404 fréquents → fallback silencieux (AssetFlag / placeholder).
 */
export function AssetLogo({ logoUrl, fallback, size = 28 }: Props) {
  const [failed, setFailed] = useState(false);

  if (!logoUrl || failed) return <>{fallback}</>;

  const inner = size - 12; // padding interne plus large → logo un peu plus petit

  return (
    <span
      className="flex items-center justify-center rounded-full border border-border bg-card shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      <Image
        src={logoUrl}
        alt=""
        width={inner}
        height={inner}
        unoptimized
        className="object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
