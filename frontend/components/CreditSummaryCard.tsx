import { formatUnits } from 'viem';

interface CreditSummaryCardProps {
    totalBorrowed: bigint;
    totalRepaid: bigint;
    outstandingDebt: bigint;
    onTimeRepayments: bigint;
    defaults: bigint;
    eventCount: bigint;
}

export default function CreditSummaryCard({
    totalBorrowed,
    totalRepaid,
    outstandingDebt,
    onTimeRepayments,
    defaults,
    eventCount,
}: CreditSummaryCardProps) {
    // Format monetary values from 1e18 scale to readable numbers
    const formatNumber = (val: string) => Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 });

    const formattedBorrowed = formatNumber(formatUnits(totalBorrowed, 18));
    const formattedRepaid = formatNumber(formatUnits(totalRepaid, 18));
    const formattedDebt = formatNumber(formatUnits(outstandingDebt, 18));

    const metrics = [
        { label: 'Total Borrowed', value: formattedBorrowed, unit: 'USC' },
        { label: 'Total Repaid', value: formattedRepaid, unit: 'USC' },
        { label: 'Outstanding Debt', value: formattedDebt, unit: 'USC' },
        { label: 'On-Time Repayments', value: onTimeRepayments.toString(), unit: '' },
        { label: 'Defaults', value: defaults.toString(), unit: '' },
        { label: 'Total Events', value: eventCount.toString(), unit: '' },
    ];

    return (
        <div className="w-full bg-neutral-900 border border-neutral-800">
            <div className="border-b border-neutral-800 px-6 py-4 bg-neutral-950">
                <h3 className="text-sm font-medium text-neutral-200 font-mono uppercase tracking-wider">
                    DIKE Protocol Aggregation
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-800 border-neutral-800">
                {metrics.map((metric, index) => (
                    <div
                        key={metric.label}
                        className={`p-6 ${index >= 3 ? 'border-t border-neutral-800' : ''} ${index % 3 !== 0 ? 'md:border-l border-neutral-800' : ''}`}
                    >
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">
                            {metric.label}
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold text-neutral-100 tracking-tight font-mono">
                                {metric.value}
                            </span>
                            {metric.unit && (
                                <span className="text-sm font-medium text-neutral-500 uppercase">
                                    {metric.unit}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
