'use client';

import { useMemo } from 'react';
import { formatUnits } from 'viem';

interface CreditEvent {
    eventId: number;
    amount: bigint;
    eventType: string;
    timestamp: number;
}

interface CreditHistoryTimelineProps {
    events: CreditEvent[];
}

export default function CreditHistoryTimeline({ events }: CreditHistoryTimelineProps) {
    const chartData = useMemo(() => {
        if (!events || events.length === 0) return [];

        // Sort chronologically
        const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

        const monthlyData = new Map<string, { value: number; types: Set<string> }>();

        sorted.forEach((evt) => {
            const date = new Date(evt.timestamp * 1000);
            const month = date.toLocaleString('default', { month: 'short', year: '2-digit' });

            let value = Number(formatUnits(evt.amount, 18));
            if (evt.eventType !== 'BORROW') {
                value = -value;
            }

            const existing = monthlyData.get(month);
            if (existing) {
                existing.value += value;
                existing.types.add(evt.eventType);
            } else {
                monthlyData.set(month, { value, types: new Set([evt.eventType]) });
            }
        });

        return Array.from(monthlyData.entries()).map(([month, data]) => {
            // Determine baseline color for the dot
            let color = '#71717a'; // gray
            if (data.types.has('DEFAULT')) {
                color = '#ef4444';      // red
            } else if (data.types.has('REPAY_LATE')) {
                color = '#facc15';      // yellow
            } else if (data.value >= 0) {
                color = '#22c55e';      // green
            } else if (data.value < 0) {
                color = '#3b82f6';      // blue
            }

            return {
                month,
                value: data.value,
                color,
            };
        });
    }, [events]);

    const height = 220;
    const width = 800; // viewbox coordinates
    const paddingY = 40;
    const paddingX = 60;

    const minVal = chartData.length > 0 ? Math.min(...chartData.map(d => d.value), 0) : 0;
    const maxVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.value), 0) : 0;

    // Create padding for Y range so dots don't clip at the very edge
    const range = Math.max(maxVal - minVal, 10);
    const adjustedMin = minVal - (range * 0.1);
    const adjustedMax = maxVal + (range * 0.1);
    const fullRange = adjustedMax - adjustedMin;

    const getX = (index: number) => {
        if (chartData.length === 1) return width / 2;
        return paddingX + (index * (width - 2 * paddingX) / (chartData.length - 1));
    };
    const getY = (value: number) => height - paddingY - ((value - adjustedMin) / fullRange) * (height - 2 * paddingY);

    const pathD = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`).join(' ');

    return (
        <div className="bg-neutral-900 rounded-2xl border border-gray-800 p-8 space-y-6">
            {/* Header Row */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <h2 className="text-sm font-semibold text-gray-400 tracking-widest uppercase">Credit History</h2>
                <button className="border border-gray-700 rounded-md px-3 py-1 text-sm text-gray-300 hover:bg-neutral-800 transition-colors">
                    Filters
                </button>
            </div>

            {chartData.length === 0 ? (
                <div className="py-16 text-center text-gray-500 text-sm">
                    No credit activity recorded yet.
                </div>
            ) : (
                <div className="w-full space-y-6">
                    <div className="w-full overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide">
                        {/* SVG Chart */}
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[600px] text-gray-400 font-mono text-xs">
                            {/* Zero Line */}
                            <line
                                x1={paddingX - 20}
                                y1={getY(0)}
                                x2={width - paddingX + 20}
                                y2={getY(0)}
                                stroke="#3f3f46"
                                strokeDasharray="4 4"
                            />

                            {/* Monotone Line */}
                            <path
                                d={pathD}
                                fill="none"
                                stroke="#52525b"
                                strokeWidth="2"
                                strokeLinejoin="round"
                            />

                            {/* Data Points */}
                            {chartData.map((d, i) => {
                                const x = getX(i);
                                const y = getY(d.value);
                                return (
                                    <g key={i} className="group transition-all">
                                        <circle
                                            cx={x}
                                            cy={y}
                                            r="5"
                                            fill={d.color}
                                            stroke="#171717"
                                            strokeWidth="2"
                                            className="group-hover:r-6 cursor-pointer"
                                        />
                                        <text
                                            x={x}
                                            y={y - 14}
                                            textAnchor="middle"
                                            fill="#a1a1aa"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            {d.value > 0 ? '+' : ''}{Math.round(d.value)}
                                        </text>
                                        <text
                                            x={x}
                                            y={height - 10}
                                            textAnchor="middle"
                                            fill="#71717a"
                                        >
                                            {d.month}
                                        </text>
                                    </g>
                                )
                            })}
                        </svg>
                    </div>

                    {/* Legend */}
                    <div className="flex justify-center gap-6 pt-4 border-t border-gray-800 text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Borrow
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Repay
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Late
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Default
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
