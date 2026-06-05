"use client";

import React, { useMemo } from "react";

const W = 80;
const H = 24;
const PAD = 2;

type Pt = { date: string; value: number };

function buildPaths(data: Pt[]) {
    const vals = data.map(d => d.value);
    const lo   = Math.min(...vals);
    const hi   = Math.max(...vals);
    const span = hi - lo || 1;
    const n    = data.length;

    const toX = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
    const toY = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);

    const coords = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`);
    const line   = `M ${coords.join(" L ")}`;
    const area   = `${line} L ${toX(n - 1).toFixed(1)},${H} L ${toX(0).toFixed(1)},${H} Z`;
    const lastX  = toX(n - 1);
    const lastY  = toY(data[n - 1].value);

    return { line, area, lastX, lastY };
}

type Props = {
    data  : Pt[];
    symbol: string;
};

export const RowSparkline = React.memo(function RowSparkline({ data, symbol }: Props) {
    if (data.length < 2) return <div style={{ width: W, height: H }} />;

    const { line, area, color, lastX, lastY } = useMemo(() => {
        const { line, area, lastX, lastY } = buildPaths(data);
        const isUp = data[data.length - 1].value >= data[0].value;
        return { line, area, color: isUp ? "#039855" : "#f04438", lastX, lastY };
    }, [data]);

    const gid = `rspk-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;

    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity={0.30} />
                    <stop offset="100%" stopColor={color} stopOpacity={0}    />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
            <path d={line} stroke={color} strokeWidth={1.5} fill="none"
                  strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
        </svg>
    );
});
