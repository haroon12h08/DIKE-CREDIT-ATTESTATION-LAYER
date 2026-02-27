interface ProtocolComparisonDemoProps {
    onTimeRepayments: bigint;
    defaults: bigint;
}

export default function ProtocolComparisonDemo({ onTimeRepayments, defaults }: ProtocolComparisonDemoProps) {
    // Logic: IF 2+ onTimeRepayments AND no defaults -> better rates
    const isEligibleForBonus = onTimeRepayments >= BigInt(2) && defaults === BigInt(0);

    return (
        <div className="w-full bg-neutral-900 border border-neutral-800">
            <div className="border-b border-neutral-800 px-6 py-4 bg-neutral-950">
                <h3 className="text-sm font-medium text-neutral-200 font-mono uppercase tracking-wider">
                    Protocol Application Engine
                </h3>
            </div>

            <div className="p-6">
                <div className="mb-6 pb-6 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h4 className="text-sm font-semibold text-neutral-100 uppercase tracking-widest mb-1">On-Chain Underwriting</h4>
                        <p className="text-sm text-neutral-400">Live demonstration of how DIKE Attestations alter borrowing parameters.</p>
                    </div>
                    {isEligibleForBonus ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 uppercase tracking-widest text-center whitespace-nowrap">
                            Premium Tier Active
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-400 uppercase tracking-widest text-center whitespace-nowrap">
                            Standard Tier Active
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Standard Protocol / Without DIKE */}
                    <div className="border border-neutral-800 bg-neutral-900/50">
                        <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-800/50 text-center">
                            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Without DIKE (Standard)</span>
                        </div>
                        <div className="p-5 flex justify-around">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Interest Rate</span>
                                <span className="text-2xl font-mono text-neutral-300">12%</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Collateral Requirement</span>
                                <span className="text-2xl font-mono text-neutral-300">150%</span>
                            </div>
                        </div>
                    </div>

                    {/* DIKE Enhanced Protocol */}
                    <div className={`border ${isEligibleForBonus ? 'border-blue-500/50 ring-1 ring-blue-500/30 bg-blue-900/10' : 'border-neutral-800 bg-neutral-900'}`}>
                        <div className={`px-4 py-3 border-b ${isEligibleForBonus ? 'border-blue-500/30 bg-blue-900/20' : 'border-neutral-800 bg-neutral-900'} text-center flex flex-col sm:flex-row items-center justify-center gap-2`}>
                            <span className={`text-xs font-semibold uppercase tracking-widest ${isEligibleForBonus ? 'text-blue-400' : 'text-neutral-300'}`}>With DIKE Attestation</span>
                        </div>
                        <div className="p-5 flex justify-around">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Interest Rate</span>
                                <span className={`text-2xl font-mono ${isEligibleForBonus ? 'text-blue-400 font-bold' : 'text-neutral-300'}`}>
                                    {isEligibleForBonus ? '6%' : '12%'}
                                </span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Collateral Requirement</span>
                                <span className={`text-2xl font-mono ${isEligibleForBonus ? 'text-blue-400 font-bold' : 'text-neutral-300'}`}>
                                    {isEligibleForBonus ? '110%' : '150%'}
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
