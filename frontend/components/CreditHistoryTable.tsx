'use client';

import React, { useState, useEffect } from 'react';
import { useDikeRegistry } from '@/hooks/useDikeRegistry';
import { formatUnits, Address } from 'viem';

interface CreditEventData {
    eventId: bigint;
    subject: Address;
    amount: bigint;
    timestamp: bigint;
    eventType: number;
    referenceHash: string;
}

const EVENT_TYPES: Record<number, string> = {
    0: 'BORROW',
    1: 'REPAY_ON_TIME',
    2: 'REPAY_LATE',
    3: 'DEFAULT',
};

const DIKE_ADDRESS = process.env.NEXT_PUBLIC_DIKE_ADDRESS;
const CREDITCOIN_EXPLORER = process.env.NEXT_PUBLIC_CREDITCOIN_EXPLORER || 'https://creditcoin-testnet.blockscout.com';
const ETHERSCAN_EXPLORER = process.env.NEXT_PUBLIC_ETHERSCAN_EXPLORER || 'https://sepolia.etherscan.io';

export default function CreditHistoryTable({ address }: { address: Address }) {
    const { getUserEvents, getCreditEvent, isReady } = useDikeRegistry();
    const [events, setEvents] = useState<CreditEventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<bigint | null>(null);

    useEffect(() => {
        async function fetchEvents() {
            if (!isReady || !address) return;
            setLoading(true);
            try {
                const eventIds = await getUserEvents(address);
                const eventPromises = eventIds.map(async (id) => {
                    const evt = await getCreditEvent(id);
                    if (evt) {
                        return { eventId: id, ...evt };
                    }
                    return null;
                });
                const resolvedEvents = (await Promise.all(eventPromises)).filter(Boolean) as CreditEventData[];
                // Sort descending by eventId
                resolvedEvents.sort((a, b) => Number(b.eventId - a.eventId));
                setEvents(resolvedEvents);
            } catch {
                // Return gracefully without blocking React boundaries
            } finally {
                setLoading(false);
            }
        }
        fetchEvents();
    }, [address, isReady, getUserEvents, getCreditEvent]);

    if (loading) {
        return (
            <div className="w-full py-12 text-center text-sm text-neutral-500 font-mono border border-neutral-800">
                Loading event history...
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="w-full py-12 text-center text-sm text-neutral-500 font-mono bg-neutral-900 border border-neutral-800">
                No credit history found for this address.
            </div>
        );
    }

    const toggleRow = (id: bigint) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const shortenHash = (hash: string) => {
        if (!hash || hash.length < 10) return hash;
        return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
    };

    return (
        <div className="w-full overflow-hidden bg-neutral-900 border border-neutral-800 mt-8 mb-16">
            <div className="border-b border-neutral-800 px-6 py-4 bg-neutral-950">
                <h3 className="text-sm font-medium text-neutral-200 font-mono uppercase tracking-wider">
                    Event History
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-950 border-b border-neutral-800">
                            <th className="px-6 py-3 text-xs font-medium tracking-widest text-neutral-500 uppercase">Event ID</th>
                            <th className="px-6 py-3 text-xs font-medium tracking-widest text-neutral-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-xs font-medium tracking-widest text-neutral-500 uppercase text-right">Amount (USC)</th>
                            <th className="px-6 py-3 text-xs font-medium tracking-widest text-neutral-500 uppercase">Date</th>
                            <th className="px-6 py-3 text-xs font-medium tracking-widest text-neutral-500 uppercase">Ref Hash</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {events.map((evt) => (
                            <React.Fragment key={evt.eventId.toString()}>
                                <tr
                                    onClick={() => toggleRow(evt.eventId)}
                                    className="hover:bg-neutral-800/50 cursor-pointer transition-colors group"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-neutral-300">
                                        #{evt.eventId.toString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-300 font-mono">
                                            {EVENT_TYPES[evt.eventType] || 'UNKNOWN'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-neutral-300 text-right">
                                        {Number(formatUnits(evt.amount, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                                        {new Date(Number(evt.timestamp) * 1000).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-neutral-500">
                                        {shortenHash(evt.referenceHash)}
                                    </td>
                                </tr>
                                {expandedRow === evt.eventId && (
                                    <tr className="bg-neutral-800/20">
                                        <td colSpan={5} className="px-6 py-4 border-t border-neutral-800 w-full animate-in slide-in-from-top-1 duration-200">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
                                                <div className="flex flex-col space-y-1">
                                                    <span className="text-xs uppercase tracking-widest text-neutral-500 font-medium">NFT Attestation Token</span>
                                                    <span className="text-sm font-mono text-neutral-200">
                                                        Token ID: {evt.eventId.toString()}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <a
                                                        href={`${CREDITCOIN_EXPLORER}/token/${DIKE_ADDRESS}/instance/${evt.eventId.toString()}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center justify-center px-4 py-2 border border-blue-500/30 bg-blue-900/20 text-blue-400 text-sm font-medium rounded hover:bg-blue-900/40 transition-colors cursor-pointer"
                                                    >
                                                        View NFT on Creditcoin ↗
                                                    </a>
                                                    <a
                                                        href={`${ETHERSCAN_EXPLORER}/tx/${evt.referenceHash}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center justify-center px-4 py-2 border border-neutral-700 bg-neutral-800 text-neutral-300 text-sm font-medium rounded hover:bg-neutral-700 transition-colors cursor-pointer"
                                                    >
                                                        Source Tx on Etherscan ↗
                                                    </a>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
