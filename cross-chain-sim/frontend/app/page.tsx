"use client";
/**
 * page.tsx — Cross-Chain Lending Simulation (port 3003)
 *
 * Three-panel UI: Chain A (Ethereum) | Chain B (Polygon) | Chain C (BNB)
 * Each panel shows local stats + required ratio for the connected wallet.
 * A global admin row toggles DIKE on all three chains simultaneously.
 *
 * No external CSS library — all inline styles.
 */

import { useEffect, useState, useCallback } from "react";

// ─── Selectors (keccak256 first 4 bytes) ──────────────────────────────────────
const SEL: Record<string, string> = {
    // per-chain reads
    "chainName()": "0x9f9c3564",
    "useDIKE()": "0x7b0fb6f8",
    "localBorrowed(address)": "0xa4d66daf",
    "localRepaid(address)": "0xff14706d",
    "activeLoan(address)": "0x9e219534",
    "getRequiredRatioFor(address)": "0x97d5c5e3",
    "getRequiredCollateral(address,uint256)": "0x9b3df6ef",
    // per-chain writes
    "borrow(uint256)": "0xc5ebeaec",
    "repay(uint256)": "0x7fb8e6e2",
    "toggleDIKE(bool)": "0x80aaef61",
    // registry reads
    "strongBorrower()": "0x97516c25",
    "weakBorrower()": "0xb0a40e22",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function enc32(n: bigint) { return n.toString(16).padStart(64, "0"); }
function encAddr(a: string) { return a.slice(2).toLowerCase().padStart(64, "0"); }
function fromHex(h: string) { return BigInt(h.startsWith("0x") ? h : "0x" + h); }
function fmt(wei: bigint) {
    const s = wei.toString().padStart(19, "0");
    const i = s.slice(0, s.length - 18) || "0";
    const d = s.slice(-18).replace(/0+$/, "") || "0";
    return `${i}.${d.slice(0, 4)}`;
}
function parse(eth: string) {
    const [i, d = ""] = eth.split(".");
    return BigInt(i) * BigInt("1000000000000000000") + BigInt(d.padEnd(18, "0").slice(0, 18));
}

async function rpc(method: string, params: unknown[] = []) {
    const w = window as typeof window & { ethereum?: unknown };
    if (!w.ethereum) throw new Error("MetaMask not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (w.ethereum as any).request({ method, params });
}

async function call(to: string, sig: string, ...args: string[]) {
    const s = SEL[sig]; if (!s) throw new Error("Unknown sig: " + sig);
    return (await rpc("eth_call", [{ to, data: s + args.join("") }, "latest"])) as string;
}

async function send(from: string, to: string, sig: string, value: bigint, ...args: string[]) {
    const s = SEL[sig]; if (!s) throw new Error("Unknown sig: " + sig);
    const hash = await rpc("eth_sendTransaction", [{
        from, to, data: s + args.join(""), value: "0x" + value.toString(16),
    }]);
    for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await rpc("eth_getTransactionReceipt", [hash])) return;
    }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ChainState = {
    name: string;
    addr: string;
    ratio: string;
    collat: string; // for 1 ETH borrow
    borrowed: string;
    repaid: string;
    activeLoan: string;
    dikeOn: boolean;
};

type AppState = {
    account: string | null;
    addrs: Record<string, string> | null;
    chains: [ChainState, ChainState, ChainState] | null;
    strongBorrower: string | null;
    weakBorrower: string | null;
    profile: "STRONG" | "WEAK" | "OWNER" | "OTHER";
    log: string[];
    busy: boolean;
};

const BORROW_ETH = "1";

const mkChain = (addr: string): ChainState => ({
    name: "…", addr, ratio: "150", collat: "1.5",
    borrowed: "0", repaid: "0", activeLoan: "0", dikeOn: false,
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function Page() {
    const [st, setSt] = useState<AppState>({
        account: null, addrs: null, chains: null,
        strongBorrower: null, weakBorrower: null, profile: "OTHER",
        log: [], busy: false,
    });

    // load addresses
    useEffect(() => {
        fetch("/deployed-addresses.json")
            .then((r) => r.json())
            .then((a) => setSt((p) => ({ ...p, addrs: a })))
            .catch(() => addLog("⚠ deployed-addresses.json not found — deploy first"));
    }, []);

    const addLog = useCallback((msg: string) => {
        setSt((p) => ({
            ...p,
            log: [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p.log].slice(0, 40),
        }));
    }, []);

    // ── Refresh all three chains ───────────────────────────────────
    const refresh = useCallback(async (account: string, addrs: Record<string, string>) => {
        const chainAddrs = [addrs.chainA, addrs.chainB, addrs.chainC];
        const chainNames = ["Chain A (Ethereum)", "Chain B (Polygon)", "Chain C (BNB)"];

        const results = await Promise.all(chainAddrs.map(async (addr, i) => {
            const [ratioH, collatH, borrowH, repaidH, loanH, dikeH] = await Promise.all([
                call(addr, "getRequiredRatioFor(address)", encAddr(account)),
                call(addr, "getRequiredCollateral(address,uint256)", encAddr(account), enc32(parse(BORROW_ETH))),
                call(addr, "localBorrowed(address)", encAddr(account)),
                call(addr, "localRepaid(address)", encAddr(account)),
                call(addr, "activeLoan(address)", encAddr(account)),
                call(addr, "useDIKE()"),
            ]);
            return {
                name: chainNames[i],
                addr,
                ratio: fromHex(ratioH).toString(),
                collat: fmt(fromHex(collatH)),
                borrowed: fmt(fromHex(borrowH)),
                repaid: fmt(fromHex(repaidH)),
                activeLoan: fmt(fromHex(loanH)),
                dikeOn: fromHex(dikeH) !== 0n,
            } as ChainState;
        }));

        // Profile detection
        const strong = addrs.strongBorrower?.toLowerCase();
        const weak = addrs.weakBorrower?.toLowerCase();
        const owner = addrs.owner?.toLowerCase();
        const accLow = account.toLowerCase();
        const profile =
            accLow === owner ? "OWNER" :
                accLow === strong ? "STRONG" :
                    accLow === weak ? "WEAK" : "OTHER";

        setSt((p) => ({
            ...p,
            chains: results as [ChainState, ChainState, ChainState],
            strongBorrower: addrs.strongBorrower,
            weakBorrower: addrs.weakBorrower,
            profile,
        }));
    }, []);

    // ── Connect ───────────────────────────────────────────────────-
    const connect = useCallback(async () => {
        if (!st.addrs) return;
        setSt((p) => ({ ...p, busy: true }));
        try {
            const [account] = await rpc("eth_requestAccounts") as string[];
            setSt((p) => ({ ...p, account, busy: false }));
            await refresh(account, st.addrs!);
            addLog(`✓ Connected: ${account.slice(0, 8)}…${account.slice(-6)}`);
        } catch (e) {
            addLog("✗ Connect: " + String(e));
            setSt((p) => ({ ...p, busy: false }));
        }
    }, [st.addrs, refresh, addLog]);

    // ── Per-chain actions ──────────────────────────────────────────
    const borrow = useCallback(async (chainAddr: string, chainName: string) => {
        if (!st.account) return;
        setSt((p) => ({ ...p, busy: true }));
        try {
            addLog(`⏳ Borrowing ${BORROW_ETH} ETH on ${chainName}…`);
            await send(st.account, chainAddr, "borrow(uint256)", 0n, enc32(parse(BORROW_ETH)));
            addLog(`✓ Borrowed on ${chainName}`);
            await refresh(st.account, st.addrs!);
        } catch (e) { addLog(`✗ Borrow (${chainName}): ` + String(e)); }
        setSt((p) => ({ ...p, busy: false }));
    }, [st.account, st.addrs, refresh, addLog]);

    const repay = useCallback(async (chainAddr: string, chainName: string, loanAmt: string) => {
        if (!st.account) return;
        setSt((p) => ({ ...p, busy: true }));
        try {
            const amt = loanAmt === "0" ? BORROW_ETH : loanAmt;
            addLog(`⏳ Repaying on ${chainName}…`);
            await send(st.account, chainAddr, "repay(uint256)", 0n, enc32(parse(amt)));
            addLog(`✓ Repaid on ${chainName}`);
            await refresh(st.account, st.addrs!);
        } catch (e) { addLog(`✗ Repay (${chainName}): ` + String(e)); }
        setSt((p) => ({ ...p, busy: false }));
    }, [st.account, st.addrs, refresh, addLog]);

    // ── Toggle DIKE on all chains ──────────────────────────────────
    const toggleDIKEAll = useCallback(async (enable: boolean) => {
        if (!st.account || !st.chains) return;
        setSt((p) => ({ ...p, busy: true }));
        try {
            addLog(`⏳ ${enable ? "Enabling" : "Disabling"} DIKE on all chains…`);
            for (const c of st.chains) {
                await send(st.account, c.addr, "toggleDIKE(bool)", 0n, enc32(enable ? 1n : 0n));
            }
            addLog(`✓ DIKE ${enable ? "ENABLED" : "DISABLED"} on Chain A, B, C`);
            await refresh(st.account, st.addrs!);
        } catch (e) { addLog("✗ Toggle DIKE: " + String(e)); }
        setSt((p) => ({ ...p, busy: false }));
    }, [st.account, st.chains, st.addrs, refresh, addLog]);

    // ─── Render ────────────────────────────────────────────────────
    const c = st.chains;
    const dikeOnAny = c ? c.some((x) => x.dikeOn) : false;
    const dikeOnAll = c ? c.every((x) => x.dikeOn) : false;
    const isOwner = st.profile === "OWNER";

    return (
        <div style={{ fontFamily: "monospace", padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
            <h1 style={{ marginBottom: 4 }}>⛓️ Cross-Chain Lending Simulation × DIKE</h1>
            <p style={{ color: "#555", marginTop: 0, marginBottom: 20 }}>
                Reputation portability across Chain A / B / C · Port 3003
            </p>

            {!st.account ? (
                <div>
                    <button onClick={connect} disabled={st.busy || !st.addrs} style={btn}>
                        {st.addrs ? "Connect Wallet" : "Loading addresses…"}
                    </button>
                    {!st.addrs && <p style={{ color: "orange" }}>⚠ Deploy contracts first.</p>}
                </div>
            ) : (
                <>
                    {/* ─── Connected row ──────────────────────────────────── */}
                    <div style={{ marginBottom: 16, fontSize: 13 }}>
                        <b>Account:</b> {st.account.slice(0, 10)}…{st.account.slice(-8)}&nbsp;&nbsp;
                        <ProfileBadge p={st.profile} />
                    </div>

                    {/* ─── Core concept banner ────────────────────────────── */}
                    <div style={{ border: "1px solid #999", borderRadius: 6, padding: "12px 18px", marginBottom: 18, background: "#fffff0" }}>
                        <b>The Problem: Reputation Silos</b>
                        <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                            Each chain tracks credit independently. A borrower with perfect history on Chain A
                            is treated as a <i>stranger</i> on Chains B and C. DIKE collapses this — all chains
                            query the same global registry.
                        </p>
                    </div>

                    {/* ─── Three chain panels ─────────────────────────────── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
                        {c ? c.map((chain) => (
                            <ChainPanel
                                key={chain.addr}
                                chain={chain}
                                busy={st.busy}
                                onBorrow={() => borrow(chain.addr, chain.name)}
                                onRepay={() => repay(chain.addr, chain.name, chain.activeLoan)}
                            />
                        )) : (
                            <div style={{ gridColumn: "1/-1", color: "#999" }}>Loading chain state…</div>
                        )}
                    </div>

                    {/* ─── Before / After comparison ──────────────────────── */}
                    <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "14px 18px", marginBottom: 18 }}>
                        <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 15 }}>Before / After DIKE</h2>
                        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "#eee" }}>
                                    <th style={th}>Chain</th>
                                    <th style={th}>Without DIKE</th>
                                    <th style={th}>With DIKE (Strong)</th>
                                    <th style={th}>With DIKE (Weak)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {["Chain A (Ethereum)", "Chain B (Polygon)", "Chain C (BNB)"].map((name, i) => {
                                    const ratio = c?.[i].ratio ?? "150";
                                    return (
                                        <tr key={name} style={{ background: i % 2 ? "#f9f9f9" : "#fff" }}>
                                            <td style={td}>{name}</td>
                                            <td style={td}>150% collateral</td>
                                            <td style={{ ...td, color: "green", fontWeight: "bold" }}>
                                                120% collateral ✓
                                                {dikeOnAny && st.profile === "STRONG" && ` (now: ${ratio}%)`}
                                            </td>
                                            <td style={td}>150% collateral</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <p style={{ fontSize: 12, color: "#666", margin: "8px 0 0" }}>
                            Strong = onTimeCount ≥ 5 AND defaultCount = 0.
                            Borrow amount = {BORROW_ETH} ETH. Required collateral shown.
                        </p>
                    </div>

                    {/* ─── DIKE global toggle ──────────────────────────────── */}
                    <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "14px 18px", marginBottom: 18 }}>
                        <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 15 }}>Global DIKE Control</h2>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13 }}>
                                Status: <b style={{ color: dikeOnAll ? "green" : dikeOnAny ? "orange" : "crimson" }}>
                                    {dikeOnAll ? "ENABLED on all chains 🟢" : dikeOnAny ? "PARTIAL" : "DISABLED on all chains 🔴"}
                                </b>
                            </span>
                            {isOwner ? (
                                <>
                                    <button onClick={() => toggleDIKEAll(true)} disabled={st.busy || dikeOnAll} style={btn}>Enable DIKE (All Chains)</button>
                                    <button onClick={() => toggleDIKEAll(false)} disabled={st.busy || !dikeOnAny} style={{ ...btn, background: "#500", color: "#fff" }}>Disable DIKE (All Chains)</button>
                                </>
                            ) : (
                                <span style={{ fontSize: 12, color: "#888" }}>ℹ Connect as Account[0] (Owner) to toggle DIKE.</span>
                            )}
                        </div>
                    </div>

                    {/* ─── Simulation profiles ─────────────────────────────── */}
                    {(st.strongBorrower || st.weakBorrower) && (
                        <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "12px 18px", marginBottom: 18, fontSize: 13 }}>
                            <b>Simulation Profiles</b>
                            <p style={{ margin: "6px 0 2px" }}>
                                🟢 <b>Strong (Account[1]):</b> <code style={{ fontSize: 11 }}>{st.strongBorrower}</code>
                                &nbsp;— onTime=10, defaults=0 → 120% ratio with DIKE
                            </p>
                            <p style={{ margin: "2px 0 0" }}>
                                🔴 <b>Weak (Account[2]):</b> <code style={{ fontSize: 11 }}>{st.weakBorrower}</code>
                                &nbsp;— onTime=1, defaults=2 → always 150%
                            </p>
                        </div>
                    )}

                    {/* ─── Log ─────────────────────────────────────────────── */}
                    <div>
                        <h3 style={{ marginBottom: 6, fontSize: 14 }}>Activity Log</h3>
                        <div style={{ background: "#111", color: "#0f0", fontFamily: "monospace", fontSize: 13, padding: "10px 14px", borderRadius: 4, minHeight: 80, maxHeight: 200, overflowY: "auto" }}>
                            {st.log.length === 0 ? <span style={{ color: "#555" }}>No activity yet…</span>
                                : st.log.map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Chain Panel ──────────────────────────────────────────────────────────────
function ChainPanel({
    chain, busy,
    onBorrow, onRepay,
}: {
    chain: ChainState;
    busy: boolean;
    onBorrow: () => void;
    onRepay: () => void;
}) {
    const hasLoan = chain.activeLoan !== "0" && chain.activeLoan !== "0.0000";
    const ratioColor = chain.ratio === "120" ? "green" : "#333";

    return (
        <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "12px 14px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 14, borderBottom: "1px solid #eee", paddingBottom: 6 }}>
                {chain.name}
            </h3>
            <Row2 label="DIKE">
                <span style={{ color: chain.dikeOn ? "green" : "crimson", fontWeight: "bold" }}>
                    {chain.dikeOn ? "ON" : "OFF"}
                </span>
            </Row2>
            <Row2 label="Collateral Ratio">
                <span style={{ color: ratioColor, fontWeight: "bold" }}>
                    {chain.ratio}%{chain.ratio === "120" && " ✓"}
                </span>
            </Row2>
            <Row2 label="For 1 ETH borrow">{chain.collat} ETH needed</Row2>
            <Row2 label="Local Borrowed">{chain.borrowed} ETH</Row2>
            <Row2 label="Local Repaid">{chain.repaid} ETH</Row2>
            <Row2 label="Active Loan">{hasLoan ? `${chain.activeLoan} ETH` : "—"}</Row2>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={onBorrow} disabled={busy || hasLoan} style={{ ...btn, fontSize: 12, padding: "6px 10px" }}>
                    Borrow 1 ETH
                </button>
                <button onClick={onRepay} disabled={busy || !hasLoan} style={{ ...btn, fontSize: 12, padding: "6px 10px" }}>
                    Repay
                </button>
            </div>
        </div>
    );
}

function Row2({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
            <span style={{ color: "#666" }}>{label}</span>
            <span>{children}</span>
        </div>
    );
}

function ProfileBadge({ p }: { p: string }) {
    const MAP: Record<string, { t: string; c: string }> = {
        STRONG: { t: "🟢 Strong Borrower", c: "green" },
        WEAK: { t: "🔴 Weak Borrower", c: "crimson" },
        OWNER: { t: "🔑 Owner", c: "#333" },
        OTHER: { t: "⚪ Other", c: "#888" },
    };
    const { t, c } = MAP[p] ?? MAP.OTHER;
    return <b style={{ color: c }}>{t}</b>;
}

const btn: React.CSSProperties = {
    padding: "7px 13px", cursor: "pointer", border: "1px solid #999",
    borderRadius: 4, background: "#222", color: "#eee", fontFamily: "monospace", fontSize: 13,
};
const th: React.CSSProperties = {
    padding: "5px 10px", border: "1px solid #ccc", textAlign: "left",
};
const td: React.CSSProperties = {
    padding: "5px 10px", border: "1px solid #ccc",
};
