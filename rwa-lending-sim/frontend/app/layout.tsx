import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "RWA Lending Pool Sim × DIKE",
    description: "Minimal RWA-style uncollateralized lending pool simulation with optional DIKE credit-score underwriting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
