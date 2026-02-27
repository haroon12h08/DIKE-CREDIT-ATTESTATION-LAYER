'use client';

import { formatUnits } from 'viem';

interface CreditOverviewProps {
    totalBorrowed: bigint;
    totalRepaid: bigint;
    outstandingDebt: bigint;
    onTimeRepayments: bigint;
    defaults: bigint;
    eventCount: bigint;
    onTimeRatio: number;
}

export default function CreditOverview({
    totalBorrowed,
    totalRepaid,
    outstandingDebt,
    onTimeRepayments,
    defaults,
    eventCount,
    onTimeRatio,
}: CreditOverviewProps) {
    const defaultsNum = Number(defaults);
    const eventsNum = Number(eventCount);

    // Defaults
    let tier = "No History";
    let tierColor = "text-gray-500";
    let progressPercent = 0;
    let percentileText = "Building reputation...";

    if (eventsNum > 0) {
        if (defaultsNum > 0) {
            tier = "High Risk";
            tierColor = "text-red-500";
            progressPercent = 25;
        } else if (onTimeRatio >= 0.9) {
            tier = "Excellent Credit";
            tierColor = "text-green-500";
            progressPercent = 88;
            percentileText = "Top 12% of DIKE users";
        } else if (onTimeRatio >= 0.75) {
            tier = "Good Credit";
            tierColor = "text-blue-500";
            progressPercent = 70;
        } else {
            tier = "Average Credit";
            tierColor = "text-yellow-500";
            progressPercent = 50;
        }
    }

    // Calculate generic deterministic score
    let score = eventsNum > 0 ? 600 + (onTimeRatio * 200) - (defaultsNum * 50) : 0;
    score = Math.floor(score);

    if (eventsNum > 0) {
        if (score < 300) score = 300;
        if (score > 850) score = 850;
    }

    // Formatting values
    const formatCurrency = (amount: bigint) => {
        const val = Number(formatUnits(amount, 18));
        if (val === 0) return '$0';
        return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    const borrowedStr = formatCurrency(totalBorrowed);
    const repaidStr = formatCurrency(totalRepaid);
    const onTimePercentage = eventsNum > 0 ? Math.round(onTimeRatio * 100) + '%' : '0%';

    return (
        <div className="bg-neutral-900 rounded-2xl border border-gray-800 p-8 space-y-6">
            {/* Top Row */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <h2 className="text-sm font-semibold text-gray-400 tracking-widest uppercase">Credit Overview</h2>
                <button className="border border-gray-700 rounded-md px-3 py-1 text-sm text-gray-300 hover:bg-neutral-800 transition-colors">
                    Refresh
                </button>
            </div>

            {/* Credit Score Display */}
            <div className="flex flex-col items-center justify-center py-6 space-y-2">
                <div className="text-6xl font-bold text-white tracking-tight">
                    {eventsNum > 0 ? score : '—'}
                </div>
                <div className={`text-lg font-medium ${tierColor}`}>
                    {tier}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 pb-4">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{percentileText}</span>
                    <span>{eventsNum > 0 ? `${progressPercent}th Percentile` : ''}</span>
                </div>
                <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-800">
                <div className="bg-neutral-800 rounded-xl p-4 text-center">
                    <p className="text-gray-400 text-sm mb-1">Borrowed</p>
                    <p className="text-xl font-semibold text-white">{borrowedStr}</p>
                </div>
                <div className="bg-neutral-800 rounded-xl p-4 text-center">
                    <p className="text-gray-400 text-sm mb-1">Repaid</p>
                    <p className="text-xl font-semibold text-white">{repaidStr}</p>
                </div>
                <div className="bg-neutral-800 rounded-xl p-4 text-center">
                    <p className="text-gray-400 text-sm mb-1">On-Time</p>
                    <p className="text-xl font-semibold text-white">{onTimePercentage}</p>
                </div>
                <div className="bg-neutral-800 rounded-xl p-4 text-center">
                    <p className="text-gray-400 text-sm mb-1">Defaults</p>
                    <p className={`text-xl font-semibold ${defaultsNum > 0 ? 'text-red-400' : 'text-white'}`}>
                        {defaultsNum}
                    </p>
                </div>
            </div>
        </div>
    );
}
