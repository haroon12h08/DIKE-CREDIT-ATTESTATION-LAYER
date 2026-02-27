import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

export const creditcoinTestnet = defineChain({
    id: 102031,
    name: 'Creditcoin Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Creditcoin',
        symbol: 'CTC',
    },
    rpcUrls: {
        default: { http: ['https://rpc.cc3-testnet.creditcoin.network'] },
    },
    blockExplorers: {
        default: {
            name: 'Blockscout',
            url: 'https://creditcoin-testnet.blockscout.com',
            apiUrl: 'https://creditcoin-testnet.blockscout.com/api',
        },
    },
    testnet: true,
});

export const config = getDefaultConfig({
    appName: 'DIKE Credit Attestation',
    projectId: 'YOUR_PROJECT_ID',
    chains: [creditcoinTestnet, sepolia],
    ssr: false,
});
