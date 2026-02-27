"use client";
/**
 * page.tsx — RWA Lending Pool Simulation UI (port 3002)
 *
 * Single-page app that connects to MetaMask and interacts with MockRWAPool
 * on the local Hardhat node. Demonstrates before/after DIKE underwriting.
 *
 * No external CSS library — inline styles only (barebones as spec requires).
 */

import { useEffect, useState, useCallback } from "react";

// ─── Hardcoded function selectors ────────────────────────────────────────────
// (computed offline from keccak256 of the function signatures)
const SEL: Record<string, string> = {
    // reads
    "totalPoolLiquidity()": "0x9f5a2e4a",
    "borrowedAmount()": "0x9f82f8f0",
    "repaymentDue()": "0x4b3b5b53",
    "repaymentsMade()": "0x7da6cbf5",
    "loanApproved()": "0xf8d4c739",
    "loanWithdrawn()": "0x5c3c5573",
    "useDIKE()": "0x7b0fb6f8",
    "borrower()": "0xe5c1e888",
    "owner()": "0x8da5cb5b",
    "remainingRepayment()": "0x9d9e3b9f",
    "dikeWouldApprove(address)": "0xc2eefb00",
    // reads — MockDIKE
    "strongBorrower()": "0x97516c25",
    "weakBorrower()": "0xb0a40e22",
    // writes
    "invest()": "0xad65d76d",
    "requestLoan(uint256)": "0x4eb2a4e0",
    "approveLoan()": "0x79e3e4e4",
    "withdrawLoan()": "0x0d1b28cc",
    "repayInstallment()": "0x3c39b4bf",
    "toggleDIKE(bool)": "0x80aaef61",
};

// ─── Tiny ABI-encode helpers ──────────────────────────────────────────────────
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

// ─── Low-level RPC ────────────────────────────────────────────────────────────
async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
    const w = window as typeof window & { ethereum?: unknown };
    if (!w.ethereum) throw new Error("MetaMask not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (w.ethereum as any).request({ method, params });
}

async function ethCall(to: string, sig: string, ...args: string[]): Promise<string> {
    const sel = SEL[sig];
    if (!sel) throw new Error("Unknown sig: " + sig);
    const data = sel + args.join("");
    return (await rpc("eth_call", [{ to, data }, "latest"])) as string;
}

async function sendTx(
    from: string, to: string, sig: string, value: bigint, ...args: string[]
): Promise<void> {
    const sel = SEL[sig];
    if (!sel) throw new Error("Unknown sig: " + sig);
    const data = sel + args.join("");
    const txHash = await rpc("eth_sendTransaction", [{
        from, to, data, value: "0x" + value.toString(16),
    }]);
    for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
        if (receipt) return;
    }
}

// ─── State type ───────────────────────────────────────────────────────────────
type Profile = "STRONG" | "WEAK" | "OWNER" | "INVESTOR" | "OTHER";

type S = {
    account: string | null;
    poolAddr: string | null;
    dikeAddr: string | null;
    strongBorrower: string | null;
    weakBorrower: string | null;
    investor: string | null;
    owner: string | null;
    // on-chain
    liquidity: string;
    borrowedAmount: string;
    repaymentDue: string;
    repaymentsMade: string;
    loanApproved: boolean;
    loanWithdrawn: boolean;
    dikeEnabled: boolean;
    activeBorrower: string | null;  // pool.borrower
    dikeWouldAppr: boolean;
    // local
    profile: Profile;
    log: string[];
    busy: boolean;
};

const INIT: S = {
    account: null, poolAddr: null, dikeAddr: null,
    strongBorrower: null, weakBorrower: null, investor: null, owner: null,
    liquidity: "0", borrowedAmount: "0", repaymentDue: "0", repaymentsMade: "0",
    loanApproved: false, loanWithdrawn: false, dikeEnabled: false,
    activeBorrower: null, dikeWouldAppr: false,
    profile: "OTHER", log: [], busy: false,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Page() {
    const [s, setS] = useState<S>(INIT);
    const [addrs, setAddrs] = useState<Record<string, string> | null>(null);

    useEffect(() => {
        fetch("/deployed-addresses.json")
            .then((r) => r.json())
            .then(setAddrs)
            .catch(() => appendLog("⚠ Could not load deployed-addresses.json — deploy contracts first."));
    }, []);

    const appendLog = useCallback((msg: string) => {
        setS((prev) => ({
            ...prev,
            log: [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.log].slice(0, 40),
        }));
    }, []);

    // ── Refresh ─────────────────────────────────────────────────────
    const refresh = useCallback(async (account: string, poolAddr: string, dikeAddr: string) => {
        try {
            const [liqH, bamtH, rdueH, rmadeH, approvedH, withdrawnH, dikeH, borrowerH, ownerH] =
                await Promise.all([
                    ethCall(poolAddr, "totalPoolLiquidity()"),
                    ethCall(poolAddr, "borrowedAmount()"),
                    ethCall(poolAddr, "repaymentDue()"),
                    ethCall(poolAddr, "repaymentsMade()"),
                    ethCall(poolAddr, "loanApproved()"),
                    ethCall(poolAddr, "loanWithdrawn()"),
                    ethCall(poolAddr, "useDIKE()"),
                    ethCall(poolAddr, "borrower()"),
                    ethCall(poolAddr, "owner()"),
                ]);

            const [strongH, weakH] = await Promise.all([
                ethCall(dikeAddr, "strongBorrower()"),
                ethCall(dikeAddr, "weakBorrower()"),
            ]);

            const activeBorrower = "0x" + borrowerH.slice(-40);
            const strong = "0x" + strongH.slice(-40);
            const weak = "0x" + weakH.slice(-40);
            const ownerA = "0x" + ownerH.slice(-40);
            const acctLow = account.toLowerCase();

            // DIKE would-approve check (only costs a view call)
            let dikeAppr = false;
            try {
                const daH = await ethCall(poolAddr, "dikeWouldApprove(address)", encodeAddress(account));
                dikeAppr = hexToBigInt(daH) !== 0n;
            } catch { /* ignore */ }

            let profile: Profile = "OTHER";
            if (acctLow === ownerA.toLowerCase()) profile = "OWNER";
            else if (acctLow === strong.toLowerCase()) profile = "STRONG";
            else if (acctLow === weak.toLowerCase()) profile = "WEAK";
            else if (addrs && acctLow === addrs.investor?.toLowerCase()) profile = "INVESTOR";

            setS((prev) => ({
                ...prev,
                liquidity: formatEther(hexToBigInt(liqH)),
                borrowedAmount: formatEther(hexToBigInt(bamtH)),
                repaymentDue: formatEther(hexToBigInt(rdueH)),
                repaymentsMade: formatEther(hexToBigInt(rmadeH)),
                loanApproved: hexToBigInt(approvedH) !== 0n,
                loanWithdrawn: hexToBigInt(withdrawnH) !== 0n,
                dikeEnabled: hexToBigInt(dikeH) !== 0n,
                activeBorrower: activeBorrower === "0x0000000000000000000000000000000000000000" ? null : activeBorrower,
                dikeWouldAppr: dikeAppr,
                strongBorrower: strong,
                weakBorrower: weak,
                owner: ownerA,
                profile,
            }));
        } catch (e) {
            appendLog("⚠ Refresh error: " + String(e));
        }
    }, [addrs, appendLog]);

    // ── Connect wallet ──────────────────────────────────────────────
    const connect = useCallback(async () => {
        if (!addrs) { appendLog("⚠ Addresses not loaded yet"); return; }
        setS((prev) => ({ ...prev, busy: true }));
        try {
            const accounts = await rpc("eth_requestAccounts") as string[];
            const account = accounts[0];
            setS((prev) => ({
                ...prev,
                account,
                poolAddr: addrs.MockRWAPool,
                dikeAddr: addrs.MockDIKE,
                investor: addrs.investor,
                busy: false,
            }));
            await refresh(account, addrs.MockRWAPool, addrs.MockDIKE);
            appendLog(`✓ Connected: ${account.slice(0, 8)}…${account.slice(-6)}`);
        } catch (e) {
            appendLog("✗ Connect failed: " + String(e));
            setS((prev) => ({ ...prev, busy: false }));
        }
    }, [addrs, refresh, appendLog]);

    // ── Invest 5 ETH ────────────────────────────────────────────────
    const invest = useCallback(async () => {
        if (!s.account || !s.poolAddr) return;
        setS((p) => ({ ...p, busy: true }));
        try {
            appendLog("⏳ Investing 5 ETH into pool…");
            await sendTx(s.account, s.poolAddr!, "invest()", parseEther("5"));
            appendLog("✓ Invested 5 ETH");
            await refresh(s.account, s.poolAddr!, s.dikeAddr!);
        } catch (e) { appendLog("✗ Invest failed: " + String(e)); }
        setS((p) => ({ ...p, busy: false }));
    }, [s.account, s.poolAddr, s.dikeAddr, refresh, appendLog]);

    // ── Request loan 3 ETH ──────────────────────────────────────────
    const requestLoan = useCallback(async () => {
        if (!s.account || !s.poolAddr) return;
        setS((p) => ({ ...p, busy: true }));
        try {
            appendLog("⏳ Requesting 3 ETH loan…");
            await sendTx(s.account, s.poolAddr!, "requestLoan(uint256)", 0n,
                encodeUint256(parseEther("3")));
            appendLog("✓ Loan request submitted");
            await refresh(s.account, s.poolAddr!, s.dikeAddr!);
        } catch (e) { appendLog("✗ Request failed: " + String(e)); }
        setS((p) => ({ ...p, busy: false }));
    }, [s.account, s.poolAddr, s.dikeAddr, refresh, appendLog]);

    // ── Approve loan ────────────────────────────────────────────────
    const approveLoan = useCallback(async () => {
        if (!s.account || !s.poolAddr) return;
        setS((p) => ({ ...p, busy: true }));
        try {
            appendLog(s.dikeEnabled
                ? "⏳ Running DIKE auto-screening…"
                : "⏳ Owner manually approving loan…");
            await sendTx(s.account, s.poolAddr!, "approveLoan()", 0n);
            await refresh(s.account, s.poolAddr!, s.dikeAddr!);
            // Check result
            const approvedH = await ethCall(s.poolAddr!, "loanApproved()");
            const approved = hexToBigInt(approvedH) !== 0n;
            appendLog(approved
                ? "✓ Loan APPROVED"
                : "✗ Loan REJECTED (DIKE: insufficient credit history)");
        } catch (e) { appendLog("✗ Approve failed: " + String(e)); }
        setS((p) => ({ ...p, busy: false }));
    }, [s.account, s.poolAddr, s.dikeAddr, s.dikeEnabled, refresh, appendLog]);

    // ── Withdraw loan ───────────────────────────────────────────────
    const withdrawLoan = useCallback(async () => {
        if (!s.account || !s.poolAddr) return;
        setS((p) => ({ ...p, busy: true }));
        try {
            appendLog("⏳ Withdrawing loan funds…");
            await sendTx(s.account, s.poolAddr!, "withdrawLoan()", 0n);
            appendLog("✓ Loan withdrawn from pool");
            await refresh(s.account, s.poolAddr!, s.dikeAddr!);
        } catch (e) { appendLog("✗ Withdraw failed: " + String(e)); }
        setS((p) => ({ ...p, busy: false }));
    }, [s.account, s.poolAddr, s.dikeAddr, refresh, appendLog]);

    // ── Repay 1 ETH installment ─────────────────────────────────────
    const repay = useCallback(async () => {
        if (!s.account || !s.poolAddr) return;
        setS((p) => ({ ...p, busy: true }));
        try {
            appendLog("⏳ Repaying 1 ETH installment…");
            await sendTx(s.account, s.poolAddr!, "repayInstallment()", parseEther("1"));
            appendLog("✓ Installment repaid");
            await refresh(s.account, s.poolAddr!, s.dikeAddr!);
        } catch (e) { appendLog("✗ Repay failed: " + String(e)); }
        setS((p) => ({ ...p, busy: false }));
    }, [s.account, s.poolAddr, s.dikeAddr, refresh, appendLog]);

    // ── Toggle DIKE ─────────────────────────────────────────────────
    const toggleDIKE = useCallback(async () => {
        if (!s.account || !s.poolAddr) return;
        setS((p) => ({ ...p, busy: true }));
        const next = !s.dikeEnabled;
        try {
            appendLog(`⏳ ${next ? "Enabling" : "Disabling"} DIKE underwriting…`);
            await sendTx(s.account, s.poolAddr!, "toggleDIKE(bool)", 0n,
                encodeUint256(next ? 1n : 0n));
            appendLog(`✓ DIKE ${next ? "ENABLED — auto-screening active" : "DISABLED — manual approval mode"}`);
            await refresh(s.account, s.poolAddr!, s.dikeAddr!);
        } catch (e) { appendLog("✗ Toggle failed: " + String(e)); }
        setS((p) => ({ ...p, busy: false }));
    }, [s.account, s.poolAddr, s.dikeAddr, s.dikeEnabled, refresh, appendLog]);

    // ─── Render ────────────────────────────────────────────────────────────────
    const connected = !!s.account;
    const isBorrower = s.profile === "STRONG" || s.profile === "WEAK";
    const isActiveBorrower = s.activeBorrower?.toLowerCase() === s.account?.toLowerCase();

    return (
        <div style={{ fontFamily: "monospace", padding: "32px", maxWidth: "820px", margin: "0 auto" }}>
            <h1 style={{ marginBottom: 4 }}>🏛️ RWA Lending Pool Simulation × DIKE</h1>
            <p style={{ color: "#555", marginTop: 0, marginBottom: 24 }}>
                Uncollateralised borrowing · Performance-based underwriting · Port 3002
            </p>

            {!connected ? (
                <div>
                    <button onClick={connect} disabled={s.busy || !addrs} style={btn}>
                        {addrs ? "Connect Wallet" : "Loading addresses…"}
                    </button>
                    {!addrs && (
                        <p style={{ color: "orange" }}>
                            ⚠ Deploy contracts first, then reload this page.
                        </p>
                    )}
                </div>
            ) : (
                <>
                    {/* ─── Pool Status ─────────────────────────────────────── */}
                    <Section title="Pool Status">
                        <Row label="Total Pool Liquidity">{s.liquidity} ETH</Row>
                        <Row label="Borrowed Amount">{s.borrowedAmount} ETH</Row>
                        <Row label="Repayment Due">{s.repaymentDue} ETH</Row>
                        <Row label="Repayments Made">{s.repaymentsMade} ETH</Row>
                        <Row label="Loan Approved">
                            <StatusBadge on={s.loanApproved} onLabel="YES ✓" offLabel="NO" />
                        </Row>
                        <Row label="Loan Withdrawn">
                            <StatusBadge on={s.loanWithdrawn} onLabel="YES" offLabel="NO" />
                        </Row>
                        <Row label="Active Borrower">
                            {s.activeBorrower
                                ? `${s.activeBorrower.slice(0, 10)}…${s.activeBorrower.slice(-6)}`
                                : "—"}
                        </Row>
                        <Row label="DIKE Underwriting">
                            <span style={{ fontWeight: "bold", color: s.dikeEnabled ? "green" : "crimson" }}>
                                {s.dikeEnabled ? "ENABLED (auto-screening)" : "DISABLED (manual approval)"}
                            </span>
                        </Row>
                    </Section>

                    {/* ─── You ─────────────────────────────────────────────── */}
                    <Section title="Your Account">
                        <Row label="Address">
                            {s.account!.slice(0, 10)}…{s.account!.slice(-8)}
                        </Row>
                        <Row label="Role"><ProfileBadge profile={s.profile} /></Row>
                        {s.dikeEnabled && isBorrower && (
                            <Row label="DIKE Would Approve You?">
                                <span style={{ fontWeight: "bold", color: s.dikeWouldAppr ? "green" : "crimson" }}>
                                    {s.dikeWouldAppr ? "YES ✓ (strong credit)" : "NO ✗ (weak credit)"}
                                </span>
                            </Row>
                        )}
                    </Section>

                    {/* ─── Before/After Comparison ─────────────────────────── */}
                    <Section title="Underwriting Comparison">
                        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "#eee" }}>
                                    <th style={th}>Borrower</th>
                                    <th style={th}>Without DIKE</th>
                                    <th style={th}>With DIKE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={td}>🟢 Strong (onTime≥5, defaults=0)</td>
                                    <td style={td}>Manual approval<br /><small>(opaque, subjective)</small></td>
                                    <td style={{ ...td, color: "green", fontWeight: "bold" }}>Auto-APPROVED ✓<br /><small>Instant capital access</small></td>
                                </tr>
                                <tr style={{ background: "#f9f9f9" }}>
                                    <td style={td}>🔴 Weak (onTime=1, defaults=2)</td>
                                    <td style={td}>Manual approval<br /><small>(looks same as strong!)</small></td>
                                    <td style={{ ...td, color: "crimson", fontWeight: "bold" }}>Auto-REJECTED ✗<br /><small>Blocked from pool</small></td>
                                </tr>
                            </tbody>
                        </table>
                        <p style={{ fontSize: 12, color: "#666", margin: "8px 0 0" }}>
                            Repayment = principal × 110% (10% fixed yield simulation). No interest accrual.
                        </p>
                    </Section>

                    {/* ─── Actions ─────────────────────────────────────────── */}
                    <Section title="Actions">
                        <div style={{ marginBottom: 8 }}>
                            <b style={{ fontSize: 12, color: "#666" }}>INVESTOR</b>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                            <button onClick={invest} disabled={s.busy} style={btn}>
                                Invest 5 ETH into Pool
                            </button>
                        </div>

                        <div style={{ marginBottom: 8 }}>
                            <b style={{ fontSize: 12, color: "#666" }}>BORROWER</b>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                            <button onClick={requestLoan} disabled={s.busy || s.loanApproved} style={btn}>
                                Request 3 ETH Loan
                            </button>
                            <button onClick={approveLoan} disabled={s.busy || !s.borrowedAmount || s.borrowedAmount === "0" || s.loanApproved} style={btn}>
                                Approve Loan {s.dikeEnabled ? "(DIKE auto)" : "(Manual)"}
                            </button>
                            <button onClick={withdrawLoan} disabled={s.busy || !s.loanApproved || s.loanWithdrawn || !isActiveBorrower} style={btn}>
                                Withdraw Loan
                            </button>
                            <button onClick={repay} disabled={s.busy || !s.loanApproved || !s.loanWithdrawn || !isActiveBorrower} style={btn}>
                                Repay 1 ETH
                            </button>
                        </div>

                        <div style={{ marginBottom: 8 }}>
                            <b style={{ fontSize: 12, color: "#666" }}>ADMIN (Owner only)</b>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {s.profile === "OWNER" ? (
                                <button
                                    onClick={toggleDIKE}
                                    disabled={s.busy}
                                    style={{
                                        ...btn,
                                        background: s.dikeEnabled ? "#7a0000" : "#004d00",
                                        color: "#fff",
                                    }}
                                >
                                    {s.dikeEnabled ? "Disable DIKE" : "Enable DIKE"}
                                </button>
                            ) : (
                                <span style={{ fontSize: 12, color: "#888" }}>
                                    ℹ Switch to Account[0] (owner) to toggle DIKE.
                                </span>
                            )}
                        </div>
                    </Section>

                    {/* ─── Profiles ─────────────────────────────────────────── */}
                    {(s.strongBorrower || s.weakBorrower) && (
                        <Section title="Simulation Profiles">
                            <p style={{ margin: "0 0 6px" }}>
                                🟢 <b>Strong (Account[1]):</b>{" "}
                                <code style={{ fontSize: 11 }}>{s.strongBorrower}</code>
                                <br />
                                &nbsp;&nbsp;&nbsp;onTimeCount=10, defaultCount=0
                            </p>
                            <p style={{ margin: 0 }}>
                                🔴 <b>Weak (Account[2]):</b>{" "}
                                <code style={{ fontSize: 11 }}>{s.weakBorrower}</code>
                                <br />
                                &nbsp;&nbsp;&nbsp;onTimeCount=1, defaultCount=2
                            </p>
                        </Section>
                    )}

                    {/* ─── Activity Log ─────────────────────────────────────── */}
                    <Section title="Activity Log">
                        <div
                            style={{
                                background: "#111",
                                color: "#0f0",
                                fontFamily: "monospace",
                                fontSize: 13,
                                padding: "10px 14px",
                                borderRadius: 4,
                                minHeight: 100,
                                maxHeight: 220,
                                overflowY: "auto",
                            }}
                        >
                            {s.log.length === 0 && <span style={{ color: "#555" }}>No activity yet…</span>}
                            {s.log.map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                    </Section>
                </>
            )}
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "14px 20px", marginBottom: 16 }}>
            <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 16 }}>{title}</h2>
            {children}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 14 }}>
            <span style={{ color: "#666" }}>{label}</span>
            <span>{children}</span>
        </div>
    );
}

function StatusBadge({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
    return (
        <span style={{ fontWeight: "bold", color: on ? "green" : "#555" }}>
            {on ? onLabel : offLabel}
        </span>
    );
}

function ProfileBadge({ profile }: { profile: string }) {
    const MAP: Record<string, { label: string; color: string }> = {
        STRONG: { label: "🟢 Strong Borrower", color: "green" },
        WEAK: { label: "🔴 Weak Borrower", color: "crimson" },
        OWNER: { label: "🔑 Owner / Admin", color: "#333" },
        INVESTOR: { label: "💰 Investor (Acct[3])", color: "#333" },
        OTHER: { label: "⚪ Other", color: "#888" },
    };
    const { label, color } = MAP[profile] ?? MAP.OTHER;
    return <span style={{ fontWeight: "bold", color }}>{label}</span>;
}

const btn: React.CSSProperties = {
    padding: "8px 14px",
    cursor: "pointer",
    border: "1px solid #999",
    borderRadius: 4,
    background: "#222",
    color: "#eee",
    fontFamily: "monospace",
    fontSize: 13,
};

const th: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #ccc",
    textAlign: "left",
    fontSize: 13,
};

const td: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #ccc",
    fontSize: 13,
    verticalAlign: "top",
};
