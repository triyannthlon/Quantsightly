"use client";

import React from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

type Props = {
    data      : { date: string; value: number }[];
    color     : string;
    gradientId: string;
};

export const MetricSparkline = React.memo(function MetricSparkline({ data, color, gradientId }: Props) {
    if (data.length < 2) return null;

    return (
        <ResponsiveContainer width="100%" height={32}>
            <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={color} stopOpacity={0.30} />
                        <stop offset="95%" stopColor={color} stopOpacity={0}    />
                    </linearGradient>
                </defs>
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
});