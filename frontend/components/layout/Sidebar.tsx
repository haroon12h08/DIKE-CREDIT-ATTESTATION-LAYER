'use client';

import { useAccount } from 'wagmi';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { icon: '🏠', label: 'Home', href: '/home' },
    { icon: '📊', label: 'Dashboard', href: '/' },
    { icon: '🏦', label: 'Protocols', href: '/protocols' },
    { icon: '🖼️', label: 'My NFTs', href: '/nfts' },
    { icon: '📈', label: 'Analytics', href: '/analytics' },
    { icon: '⚙️', label: 'Settings', href: '/settings' },
];

const recentActivity = [
    { text: 'Repaid $5k on Aave' },
    { text: 'New NFT #042 minted' },
    { text: 'Borrowed $10k on Compound' },
];

export default function Sidebar() {
    const { address, chainId } = useAccount();
    const pathname = usePathname();

    const shortAddress = address
        ? `${address.slice(0, 6)}…${address.slice(-4)}`
        : 'Not Connected';

    const chainName =
        chainId === 102031
            ? 'Creditcoin Testnet'
            : chainId === 102030
                ? 'Creditcoin Mainnet'
                : chainId
                    ? `Chain ${chainId}`
                    : 'No Network';

    return (
        <aside className="hidden md:flex flex-col w-64 shrink-0 bg-neutral-950 border-r border-gray-800 h-full overflow-y-auto">
            <div className="flex flex-col flex-1 px-4 py-6 gap-0">

                {/* USER CARD */}
                <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-neutral-900 border border-gray-800 mb-6">
                    <div className="w-14 h-14 rounded-full bg-neutral-800 border border-gray-700 flex items-center justify-center">
                        <span className="text-green-400 font-mono font-bold text-lg">
                            {address ? address.slice(2, 4).toUpperCase() : '??'}
                        </span>
                    </div>
                    <div className="text-center">
                        <p className="text-white text-sm font-medium font-mono">{shortAddress}</p>
                        <p className="text-gray-500 text-xs mt-0.5">ENS not resolved</p>
                    </div>
                    <div className="w-full pt-2 border-t border-gray-800 text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Credit Score</p>
                        <p className="text-green-400 font-semibold text-lg mt-0.5">—</p>
                    </div>
                </div>

                {/* NAV MENU */}
                <nav className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left w-full
                                    ${isActive
                                        ? 'bg-neutral-800 text-white border border-gray-700'
                                        : 'text-gray-400 hover:bg-neutral-900 hover:text-white'
                                    }`}
                            >
                                <span className="text-base leading-none">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* NETWORK */}
                <div className="mt-6">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-widest px-1 mb-2">Network</p>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-neutral-900 border border-gray-800">
                        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                        <span className="text-gray-300 text-xs font-mono truncate">{chainName}</span>
                    </div>
                </div>

                {/* QUICK STATS */}
                <div className="mt-6">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-widest px-1 mb-2">Quick Stats</p>
                    <div className="flex flex-col gap-2">
                        {[
                            { label: 'Total Value', value: '—' },
                            { label: 'Active Loans', value: '—' },
                            { label: 'Protocols', value: '—' },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-900 border border-gray-800"
                            >
                                <span className="text-gray-500 text-xs">{stat.label}</span>
                                <span className="text-gray-300 text-xs font-mono font-medium">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RECENT ACTIVITY */}
                <div className="mt-6">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-widest px-1 mb-2">Recent Activity</p>
                    <div className="flex flex-col gap-2">
                        {recentActivity.map((item, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-gray-800"
                            >
                                <span className="w-1 h-1 mt-1.5 rounded-full bg-green-400 shrink-0" />
                                <span className="text-gray-400 text-xs leading-relaxed">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </aside>
    );
}
