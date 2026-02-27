'use client';

import WalletConnect from '@/components/WalletConnect';
import { useAccount } from 'wagmi';

export default function TopNav() {
    const { address, chainId } = useAccount();

    const chainName =
        chainId === 102031
            ? 'Creditcoin Testnet'
            : chainId === 102030
                ? 'Creditcoin Mainnet'
                : chainId
                    ? `Chain ${chainId}`
                    : null;

    const shortAddress = address
        ? `${address.slice(0, 6)}…${address.slice(-4)}`
        : null;

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-black border-b border-gray-800 flex items-center px-6 justify-between">
            {/* LEFT — Logo + Domain */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-neutral-900 border border-gray-700 flex items-center justify-center">
                    <span className="text-green-400 font-mono font-bold text-sm">DK</span>
                </div>
                <div className="flex flex-col leading-tight">
                    <span className="text-white font-semibold text-sm tracking-tight">DIKE</span>
                    <span className="text-gray-500 font-mono text-xs">dike.credit</span>
                </div>
            </div>

            {/* RIGHT — Search + Icons + Wallet */}
            <div className="flex items-center gap-4">
                {/* Search (UI only) */}
                <div className="hidden md:flex items-center gap-2 bg-neutral-900 border border-gray-800 rounded-lg px-3 py-1.5">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search…"
                        readOnly
                        className="bg-transparent text-gray-400 text-sm outline-none w-40 placeholder:text-gray-600 cursor-default"
                    />
                </div>

                {/* Notifications (UI only) */}
                <button className="w-8 h-8 rounded-lg bg-neutral-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-200 hover:border-gray-700 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
                    </svg>
                </button>

                {/* Chain badge */}
                {chainName && (
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-gray-800 text-xs text-gray-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                        {chainName}
                    </div>
                )}

                {/* Address display */}
                {shortAddress && (
                    <div className="hidden sm:flex items-center px-2.5 py-1 rounded-lg bg-neutral-900 border border-gray-800 text-xs font-mono text-gray-300">
                        {shortAddress}
                    </div>
                )}

                {/* Wallet connect button */}
                <WalletConnect />
            </div>
        </header>
    );
}
