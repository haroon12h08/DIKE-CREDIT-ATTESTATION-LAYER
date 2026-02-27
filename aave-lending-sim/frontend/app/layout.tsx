import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Aave Lending Sim × DIKE",
    description: "Minimal DeFi lending protocol simulation with optional DIKE credit-score underwriting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
