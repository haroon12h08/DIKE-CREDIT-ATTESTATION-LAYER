import type { Metadata } from "next";
export const metadata: Metadata = {
    title: "Cross-Chain Lending Sim × DIKE",
    description: "Reputation portability simulation across Chain A/B/C via DIKE cross-chain credit registry",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return <html lang="en"><body>{children}</body></html>;
}
