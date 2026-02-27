'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function WalletConnect() {
    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
            }) => {
                // Wait until mounted to prevent hydration errors
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus ||
                        authenticationStatus === 'authenticated');

                if (!ready) {
                    return (
                        <div
                            className=""
                            style={{ opacity: 0, pointerEvents: 'none', userSelect: 'none' }}
                        >
                            <button aria-hidden="true" className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded">
                                Connecting...
                            </button>
                        </div>
                    );
                }

                return (
                    <div
                        {...(!ready ? {
                            'aria-hidden': true,
                            style: {
                                opacity: 0,
                                pointerEvents: 'none',
                                userSelect: 'none',
                            },
                        } : {})}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        type="button"
                                        className="px-4 py-2 border border-neutral-700 bg-neutral-900 text-neutral-100 rounded text-sm font-medium hover:bg-neutral-800 transition-colors"
                                    >
                                        Connect Wallet
                                    </button>
                                );
                            }

                            if (chain.unsupported) {
                                return (
                                    <button
                                        onClick={openChainModal}
                                        type="button"
                                        className="px-4 py-2 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600 transition-colors"
                                    >
                                        Wrong network
                                    </button>
                                );
                            }

                            return (
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        onClick={openChainModal}
                                        type="button"
                                        className="flex items-center gap-2 px-3 py-1.5 border border-neutral-700 bg-neutral-800 text-neutral-200 rounded text-sm hover:bg-neutral-700 transition-colors"
                                    >
                                        {chain.hasIcon && (
                                            <div className="w-4 h-4 rounded-full overflow-hidden bg-neutral-700 flex items-center justify-center">
                                                {chain.iconUrl && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        alt={chain.name ?? 'Chain icon'}
                                                        src={chain.iconUrl}
                                                        className="w-4 h-4"
                                                    />
                                                )}
                                            </div>
                                        )}
                                        {chain.name}
                                    </button>

                                    <button
                                        onClick={openAccountModal}
                                        type="button"
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                                    >
                                        {account.displayName}
                                        {account.displayBalance
                                            ? ` (${account.displayBalance})`
                                            : ''}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
}
