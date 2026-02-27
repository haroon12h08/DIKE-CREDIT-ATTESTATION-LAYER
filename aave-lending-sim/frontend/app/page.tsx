"use client";
/**
 * page.tsx — Aave Lending Simulation UI (port 3001)
 *
 * Single-page app that connects to MetaMask, reads/writes MockAaveLending
 * on the local Hardhat node, and visually demonstrates the before/after
 * DIKE collateral ratio comparison.
 *
 * No external CSS library — uses inline styles only (intentionally barebones).
 */

import { useEffect, useState, useCallback } from "react";

// ─── ABI (only the functions we call) ────────────────────────────────────────
const LENDING_ABI = [
    // Read
    "function collateralDeposited(address) view returns (uint256)",
    "function borrowedAmount(address) view returns (uint256)",
    "function useDIKE() view returns (bool)",
    "function getRequiredRatioFor(address) view returns (uint256)",
    "function getRequiredCollateral(address, uint256) view returns (uint256)",
    "function owner() view returns (address)",
    // Write
    "function depositCollateral() payable",
    "function borrow(uint256) payable",
    "function repay() payable",
    "function toggleDIKE(bool)",
];

const DIKE_ABI = [
    "function strongBorrower() view returns (address)",
    "function weakBorrower() view returns (address)",
    "function getCreditSummary(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256)",
];

// ─── Types ────────────────────────────────────────────────────────────────────
type State = {
    account: string | null;
    lendingAddr: string | null;
    dikeAddr: string | null;
    strongBorrower: string | null;
    weakBorrower: string | null;
    collateral: string; // ETH formatted
    borrowed: string; // ETH formatted
    ratio: string; // e.g. "150"
    requiredCollat: string; // for 1 ETH borrow
    dikeEnabled: boolean;
    isOwner: boolean;
    borrowerProfile: "STRONG" | "WEAK" | "UNKNOWN";
    log: string[];
    busy: boolean;
};

const BORROW_AMOUNT_ETH = "0.5";

const INIT: State = {
    account: null,
    lendingAddr: null,
    dikeAddr: null,
    strongBorrower: null,
    weakBorrower: null,
    collateral: "0",
    borrowed: "0",
    ratio: "150",
    requiredCollat: "0.75",
    dikeEnabled: false,
    isOwner: false,
    borrowerProfile: "UNKNOWN",
    log: [],
    busy: false,
};

// ─── Tiny ethers-like helpers using window.ethereum directly ──────────────────
async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
    const w = window as typeof window & { ethereum?: unknown };
    if (!w.ethereum) throw new Error("MetaMask not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (w.ethereum as any).request({ method, params });
}

function encodeUint256(n: bigint): string {
    return n.toString(16).padStart(64, "0");
}

function encodeAddress(addr: string): string {
    return addr.slice(2).toLowerCase().padStart(64, "0");
}

function hexToBigInt(hex: string): bigint {
    return BigInt(hex.startsWith("0x") ? hex : "0x" + hex);
}

function formatEther(wei: bigint): string {
    const str = wei.toString().padStart(19, "0");
    const int = str.slice(0, str.length - 18) || "0";
    const dec = str.slice(-18).replace(/0+$/, "") || "0";
    return `${int}.${dec.slice(0, 6)}`;
}

function parseEther(eth: string): bigint {
    const [int, dec = ""] = eth.split(".");
    const decPadded = dec.padEnd(18, "0").slice(0, 18);
    return BigInt(int) * BigInt("1000000000000000000") + BigInt(decPadded);
}

// ─── ABI encode: 4-byte selector + params ─────────────────────────────────────
function selector(sig: string): string {
    // Tiny keccak-like — we hard-code selectors for the 5 functions we call
    const sigs: Record<string, string> = {
        "depositCollateral()": "0x440e6680",
        "borrow(uint256)": "0xc5ebeaec",
        "repay()": "0xa6f2ae3a",
        "toggleDIKE(bool)": "0x80aaef61",
        // reads
        "collateralDeposited(address)": "0x638415a6",
        "borrowedAmount(address)": "0x5a45d345",
        "useDIKE()": "0x7b0fb6f8",
        "getRequiredRatioFor(address)": "0x97d5c5e3",
        "getRequiredCollateral(address,uint256)": "0x9b3df6ef",
        "owner()": "0x8da5cb5b",
        "strongBorrower()": "0x97516c25",
        "weakBorrower()": "0xb0a40e22",
        "getCreditSummary(address)": "0x3082d69b",
    };
    if (sigs[sig]) return sigs[sig];
    throw new Error("Unknown sig: " + sig);
}

async function callContract(to: string, sig: string, ...args: string[]): Promise<string> {
    const data = selector(sig) + args.join("");
    const result = await rpc("eth_call", [{ to, data }, "latest"]);
    return result as string;
}

async function sendTx(from: string, to: string, sig: string, value: bigint, ...args: string[]): Promise<void> {
    const data = selector(sig) + args.join("");
    const txHash = await rpc("eth_sendTransaction", [{
        from,
        to,
        data,
        value: "0x" + value.toString(16),
    }]);
    // Poll for receipt
    for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
        if (receipt) return;
    }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Page() {
    const [s, setS] = useState<State>(INIT);
    const [addrs, setAddrs] = useState<{
        MockAaveLending: string;
        MockDIKE: string;
        strongBorrower: string;
        weakBorrower: string;
        owner: string;
    } | null>(null);

    // ── Load deployed addresses from public JSON ──────────────────────────────
    useEffect(() => {
        fetch("/deployed-addresses.json")
            .then((r) => r.json())
            .then(setAddrs)
            .catch(() =>
                log("⚠ Could not load deployed-addresses.json. Deploy contracts first.")
            );
    }, []);

    const log = useCallback((msg: string) => {
        setS((prev) => ({ ...prev, log: [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.log].slice(0, 30) }));
    }, []);

    // ── Refresh on-chain state ────────────────────────────────────────────────
    const refresh = useCallback(async (account: string, lending: string, dike: string) => {
        try {
            const [collHex, borrowHex, dikeHex, ratioHex, reqHex, ownerHex] = await Promise.all([
                callContract(lending, "collateralDeposited(address)", encodeAddress(account)),
                callContract(lending, "borrowedAmount(address)", encodeAddress(account)),
                callContract(lending, "useDIKE()"),
                callContract(lending, "getRequiredRatioFor(address)", encodeAddress(account)),
                callContract(lending, "getRequiredCollateral(address,uint256)",
                    encodeAddress(account),
                    encodeUint256(parseEther(BORROW_AMOUNT_ETH))),
                callContract(lending, "owner()"),
            ]);

            const [strongHex, weakHex] = await Promise.all([
                callContract(dike, "strongBorrower()"),
                callContract(dike, "weakBorrower()"),
            ]);

            const strong = "0x" + strongHex.slice(-40);
            const weak = "0x" + weakHex.slice(-40);
            const owner = "0x" + ownerHex.slice(-40);

            let profile: State["borrowerProfile"] = "UNKNOWN";
            if (account.toLowerCase() === strong.toLowerCase()) profile = "STRONG";
            else if (account.toLowerCase() === weak.toLowerCase()) profile = "WEAK";

            setS((prev) => ({
                ...prev,
                collateral: formatEther(hexToBigInt(collHex)),
                borrowed: formatEther(hexToBigInt(borrowHex)),
                dikeEnabled: hexToBigInt(dikeHex) !== 0n,
                ratio: hexToBigInt(ratioHex).toString(),
                requiredCollat: formatEther(hexToBigInt(reqHex)),
                isOwner: account.toLowerCase() === owner.toLowerCase(),
                borrowerProfile: profile,
                strongBorrower: strong,
                weakBorrower: weak,
            }));
        } catch (e) {
            log("⚠ Refresh failed: " + String(e));
        }
    }, [log]);

    // ── Connect wallet ────────────────────────────────────────────────────────
    const connect = useCallback(async () => {
        if (!addrs) { log("⚠ Addresses not loaded yet"); return; }
        setS((prev) => ({ ...prev, busy: true }));
        try {
            const accounts = await rpc("eth_requestAccounts") as string[];
            const account = accounts[0];
            setS((prev) => ({
                ...prev,
                account,
                lendingAddr: addrs.MockAaveLending,
                dikeAddr: addrs.MockDIKE,
                busy: false,
            }));
            await refresh(account, addrs.MockAaveLending, addrs.MockDIKE);
            log(`✓ Connected: ${account.slice(0, 8)}…${account.slice(-6)}`);
        } catch (e) {
            log("✗ Connect failed: " + String(e));
            setS((prev) => ({ ...prev, busy: false }));
        }
    }, [addrs, refresh, log]);

    // ── Action: deposit 1 ETH collateral ─────────────────────────────────────
    const deposit = useCallback(async () => {
        if (!s.account || !s.lendingAddr) return;
        setS((prev) => ({ ...prev, busy: true }));
        try {
            log("⏳ Depositing 1 ETH collateral…");
            await sendTx(s.account, s.lendingAddr, "depositCollateral()", parseEther("1"));
            log("✓ Deposited 1 ETH");
            await refresh(s.account, s.lendingAddr, s.dikeAddr!);
        } catch (e) { log("✗ Deposit failed: " + String(e)); }
        setS((prev) => ({ ...prev, busy: false }));
    }, [s.account, s.lendingAddr, s.dikeAddr, refresh, log]);

    // ── Action: borrow 0.5 ETH ────────────────────────────────────────────────
    const borrow = useCallback(async () => {
        if (!s.account || !s.lendingAddr) return;
        setS((prev) => ({ ...prev, busy: true }));
        try {
            log(`⏳ Borrowing ${BORROW_AMOUNT_ETH} ETH…`);
            await sendTx(s.account, s.lendingAddr, "borrow(uint256)", 0n,
                encodeUint256(parseEther(BORROW_AMOUNT_ETH)));
            log(`✓ Borrowed ${BORROW_AMOUNT_ETH} ETH`);
            await refresh(s.account, s.lendingAddr, s.dikeAddr!);
        } catch (e) { log("✗ Borrow failed: " + String(e)); }
        setS((prev) => ({ ...prev, busy: false }));
    }, [s.account, s.lendingAddr, s.dikeAddr, refresh, log]);

    // ── Action: repay ────────────────────────────────────────────────────────
    const repay = useCallback(async () => {
        if (!s.account || !s.lendingAddr) return;
        setS((prev) => ({ ...prev, busy: true }));
        try {
            log("⏳ Repaying loan…");
            const value = parseEther(s.borrowed);
            await sendTx(s.account, s.lendingAddr, "repay()", value);
            log("✓ Loan repaid");
            await refresh(s.account, s.lendingAddr, s.dikeAddr!);
        } catch (e) { log("✗ Repay failed: " + String(e)); }
        setS((prev) => ({ ...prev, busy: false }));
    }, [s.account, s.lendingAddr, s.dikeAddr, s.borrowed, refresh, log]);

    // ── Action: toggle DIKE ──────────────────────────────────────────────────
    const toggleDIKE = useCallback(async () => {
        if (!s.account || !s.lendingAddr) return;
        setS((prev) => ({ ...prev, busy: true }));
        try {
            const next = !s.dikeEnabled;
            log(`⏳ ${next ? "Enabling" : "Disabling"} DIKE…`);
            await sendTx(s.account, s.lendingAddr, "toggleDIKE(bool)", 0n,
                encodeUint256(next ? 1n : 0n));
            log(`✓ DIKE ${next ? "enabled" : "disabled"}`);
            await refresh(s.account, s.lendingAddr, s.dikeAddr!);
        } catch (e) { log("✗ Toggle failed: " + String(e)); }
        setS((prev) => ({ ...prev, busy: false }));
    }, [s.account, s.lendingAddr, s.dikeAddr, s.dikeEnabled, refresh, log]);

    // ─── Render ───────────────────────────────────────────────────────────────
    const connected = !!s.account;

    return (
        <div style={{ fontFamily: "monospace", padding: "32px", maxWidth: "760px", margin: "0 auto" }}>
            <h1 style={{ marginBottom: 4 }}>🏦 Aave Lending Simulation × DIKE</h1>
            <p style={{ color: "#555", marginTop: 0, marginBottom: 24 }}>
                Overcollateralised lending · Capital efficiency with DIKE credit scores · Port 3001
            </p>

            {/* ── Connect ──────────────────────────────────────────────── */}
            {!connected ? (
                <div>
                    <button onClick={connect} disabled={s.busy || !addrs} style={btnStyle}>
                        {addrs ? "Connect Wallet" : "Loading addresses…"}
                    </button>
                    {!addrs && (
                        <p style={{ color: "orange" }}>
                            ⚠ Waiting for deployed-addresses.json — deploy the contracts first.
                        </p>
                    )}
                </div>
            ) : (
                <>
                    {/* ── Status Panel ───────────────────────────────────────── */}
                    <div
                        style={{
                            border: "1px solid #ccc",
                            borderRadius: 6,
                            padding: "16px 20px",
                            marginBottom: 20,
                            background: "#fafafa",
                        }}
                    >
                        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Status</h2>

                        <Row label="Account">
                            {s.account!.slice(0, 10)}…{s.account!.slice(-8)}
                        </Row>
                        <Row label="Borrower Profile">
                            <ProfileBadge profile={s.borrowerProfile} />
                        </Row>
                        <Row label="Deposited Collateral">{s.collateral} ETH</Row>
                        <Row label="Borrowed Amount">{s.borrowed} ETH</Row>
                        <Row label="DIKE Enabled">
                            <span
                                style={{
                                    fontWeight: "bold",
                                    color: s.dikeEnabled ? "green" : "crimson",
                                }}
                            >
                                {s.dikeEnabled ? "YES" : "NO"}
                            </span>
                        </Row>

                        <hr style={{ margin: "12px 0", borderColor: "#ddd" }} />

                        <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                            Underwriting for borrow of {BORROW_AMOUNT_ETH} ETH
                        </h3>
                        <Row label="Collateral Ratio Applied">
                            <span style={{ color: s.ratio === "110" ? "green" : "#333" }}>
                                {s.ratio}%{" "}
                                {s.ratio === "110" && "(🎉 DIKE preferred rate)"}
                                {s.ratio === "150" && "(standard rate)"}
                            </span>
                        </Row>
                        <Row label="Required Collateral">{s.requiredCollat} ETH</Row>
                    </div>

                    {/* ── Comparison Table ────────────────────────────────────── */}
                    <div
                        style={{
                            border: "1px solid #ccc",
                            borderRadius: 6,
                            padding: "16px 20px",
                            marginBottom: 20,
                            background: "#f5f5ff",
                        }}
                    >
                        <h2 style={{ marginTop: 0, marginBottom: 10 }}>
                            Before / After DIKE Underwriting
                        </h2>
                        <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                            Borrow 0.5 ETH · required collateral:
                        </p>
                        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
                            <thead>
                                <tr style={{ background: "#eee" }}>
                                    <th style={th}>Borrower</th>
                                    <th style={th}>w/o DIKE</th>
                                    <th style={th}>w/ DIKE</th>
                                    <th style={th}>Savings</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={td}>🟢 Strong (onTime≥5, defaults=0)</td>
                                    <td style={td}>0.75 ETH</td>
                                    <td style={{ ...td, color: "green", fontWeight: "bold" }}>0.55 ETH</td>
                                    <td style={{ ...td, color: "green" }}>0.20 ETH</td>
                                </tr>
                                <tr style={{ background: "#f5f5f5" }}>
                                    <td style={td}>🔴 Weak (onTime=1, defaults=2)</td>
                                    <td style={td}>0.75 ETH</td>
                                    <td style={td}>0.75 ETH</td>
                                    <td style={td}>—</td>
                                </tr>
                            </tbody>
                        </table>
                        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#666" }}>
                            Your current ratio ({s.ratio}%) applies because DIKE is{" "}
                            {s.dikeEnabled ? "enabled" : "disabled"} and your profile is{" "}
                            <b>{s.borrowerProfile}</b>.
                        </p>
                    </div>

                    {/* ── Action Buttons ──────────────────────────────────────── */}
                    <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 10 }}>
                        <button onClick={deposit} disabled={s.busy} style={btnStyle}>
                            Deposit 1 ETH Collateral
                        </button>
                        <button onClick={borrow} disabled={s.busy} style={btnStyle}>
                            Borrow {BORROW_AMOUNT_ETH} ETH
                        </button>
                        <button onClick={repay} disabled={s.busy || s.borrowed === "0"} style={btnStyle}>
                            Repay Loan
                        </button>
                        {s.isOwner && (
                            <button onClick={toggleDIKE} disabled={s.busy} style={{ ...btnStyle, background: s.dikeEnabled ? "#800" : "#080", color: "#fff" }}>
                                {s.dikeEnabled ? "Disable DIKE" : "Enable DIKE"}
                            </button>
                        )}
                    </div>

                    {!s.isOwner && (
                        <p style={{ fontSize: 12, color: "#888" }}>
                            ℹ Only the owner account can toggle DIKE. Switch to Hardhat account[0] to enable/disable.
                        </p>
                    )}

                    {/* ── Credit Profiles ─────────────────────────────────────── */}
                    {(s.strongBorrower || s.weakBorrower) && (
                        <div
                            style={{
                                border: "1px solid #ccc",
                                borderRadius: 6,
                                padding: "14px 20px",
                                marginBottom: 20,
                                fontSize: 13,
                            }}
                        >
                            <h3 style={{ marginTop: 0 }}>Simulation Profiles</h3>
                            <p>
                                🟢 <b>Strong:</b>{" "}
                                <code style={{ fontSize: 12 }}>{s.strongBorrower}</code>
                                <br />
                                &nbsp;&nbsp;&nbsp;&nbsp;onTimeCount=10, defaultCount=0 → ratio 110% (with DIKE)
                            </p>
                            <p style={{ marginBottom: 0 }}>
                                🔴 <b>Weak:</b>{" "}
                                <code style={{ fontSize: 12 }}>{s.weakBorrower}</code>
                                <br />
                                &nbsp;&nbsp;&nbsp;&nbsp;onTimeCount=1, defaultCount=2 → ratio 150% (always)
                            </p>
                        </div>
                    )}

                    {/* ── Activity Log ────────────────────────────────────────── */}
                    <div>
                        <h3 style={{ marginBottom: 6 }}>Activity Log</h3>
                        <div
                            style={{
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "10px 14px",
                                background: "#111",
                                color: "#0f0",
                                fontFamily: "monospace",
                                fontSize: 13,
                                minHeight: 100,
                                maxHeight: 220,
                                overflowY: "auto",
                            }}
                        >
                            {s.log.length === 0 && <span style={{ color: "#555" }}>No activity yet…</span>}
                            {s.log.map((l, i) => (
                                <div key={i}>{l}</div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 14 }}>
            <span style={{ color: "#666" }}>{label}</span>
            <span>{children}</span>
        </div>
    );
}

function ProfileBadge({ profile }: { profile: State["borrowerProfile"] }) {
    const map = {
        STRONG: { label: "🟢 Strong Borrower", color: "green" },
        WEAK: { label: "🔴 Weak Borrower", color: "crimson" },
        UNKNOWN: { label: "⚪ Unknown", color: "#888" },
    };
    const { label, color } = map[profile];
    return <span style={{ color, fontWeight: "bold" }}>{label}</span>;
}

const btnStyle: React.CSSProperties = {
    padding: "8px 16px",
    cursor: "pointer",
    border: "1px solid #999",
    borderRadius: 4,
    background: "#222",
    color: "#eee",
    fontFamily: "monospace",
    fontSize: 14,
};

const th: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #ccc",
    textAlign: "left",
};

const td: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #ccc",
};
