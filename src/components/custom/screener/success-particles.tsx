"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

type Props = {
    origin        : { x: number; y: number };
    count        ?: number;
    onDoneAction ?: () => void;
};

/**
 * Effet « particules » de validation (Moment 5) : quelques mini-cercles primary
 * s'envolent du bouton vers le coin haut-droit (zone du toast). Joué une seule fois,
 * puis le parent retire le composant via onDoneAction.
 */
export function SuccessParticles({ origin, count = 3, onDoneAction }: Props) {
    const n = Math.min(Math.max(count, 1), 5);

    const target = useMemo(
        () => ({
            x: typeof window !== "undefined" ? window.innerWidth - 48 : origin.x,
            y: 44,
        }),
        [origin.x],
    );

    return (
        <div className="pointer-events-none fixed inset-0 z-120">
            {Array.from({ length: n }).map((_, i) => {
                const jitter = (i - (n - 1) / 2) * 16;
                const ox     = origin.x + jitter;
                const midX   = (ox + target.x) / 2;

                return (
                    <motion.span
                        key={i}
                        initial={{ x: ox, y: origin.y, opacity: 1, scale: 1 }}
                        animate={{
                            x      : [ox, midX, target.x],
                            y      : [origin.y, origin.y - 90, target.y],
                            opacity: [1, 1, 0],
                            scale  : [1, 0.85, 0.4],
                        }}
                        transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.04 }}
                        onAnimationComplete={i === n - 1 ? onDoneAction : undefined}
                        className="absolute left-0 top-0 h-2 w-2 rounded-full bg-primary"
                        style={{ boxShadow: "0 0 8px var(--color-primary)" }}
                    />
                );
            })}
        </div>
    );
}
