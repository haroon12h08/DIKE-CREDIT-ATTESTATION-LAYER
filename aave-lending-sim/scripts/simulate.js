/**
 * simulate.js
 * -----------
 * Demonstrates the before/after DIKE underwriting comparison.
 *
 * Prerequisites:
 *   - Hardhat node running: npx hardhat node
 *   - Contracts deployed:  node scripts/deploy.js
 *
 * Run:
 *   node scripts/simulate.js
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const W = (n) => hre.ethers.parseEther(String(n));
const E = (n) => hre.ethers.formatEther(n);

async function main() {
    // Load deployed addresses
    const addrFile = path.join(__dirname, "..", "deployed-addresses.json");
    if (!fs.existsSync(addrFile)) {
        throw new Error("deployed-addresses.json not found. Run `node scripts/deploy.js` first.");
    }
    const addrs = JSON.parse(fs.readFileSync(addrFile, "utf8"));

    const signers = await hre.ethers.getSigners();
    const owner = signers[0];
    const strongBorrower = signers[1];
    const weakBorrower = signers[2];

    const lending = await hre.ethers.getContractAt(
        "MockAaveLending",
        addrs.MockAaveLending,
        owner
    );

    const BORROW_AMOUNT = W("1"); // 1 ETH

    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  DIKE × Aave Lending — Underwriting Simulation");
    console.log("══════════════════════════════════════════════════════════");

    // ───────────────────────────────────────────────────────────────
    // SCENARIO A — WITHOUT DIKE
    // ───────────────────────────────────────────────────────────────
    console.log("\n┌──────────────────────────────────────────────┐");
    console.log("│  SCENARIO A: Without DIKE (useDIKE = false)  │");
    console.log("└──────────────────────────────────────────────┘");

    const ratioStrong_noDIKE = await lending.getRequiredRatioFor(strongBorrower.address);
    const ratioWeak_noDIKE = await lending.getRequiredRatioFor(weakBorrower.address);
    const collStrong_noDIKE = await lending.getRequiredCollateral(strongBorrower.address, BORROW_AMOUNT);
    const collWeak_noDIKE = await lending.getRequiredCollateral(weakBorrower.address, BORROW_AMOUNT);

    console.log(`  Strong Borrower | ratio: ${ratioStrong_noDIKE}% | required collateral: ${E(collStrong_noDIKE)} ETH`);
    console.log(`  Weak   Borrower | ratio: ${ratioWeak_noDIKE}%   | required collateral: ${E(collWeak_noDIKE)} ETH`);
    console.log(`\n  → Borrow 1 ETH requires 1.5 ETH collateral for BOTH borrowers`);

    // ── Live borrow demo (strong borrower, no DIKE) ─────────────────
    const depositTx1 = await lending.connect(strongBorrower).depositCollateral({
        value: W("1.5"),
    });
    await depositTx1.wait();

    const borrowTx1 = await lending.connect(strongBorrower).borrow(BORROW_AMOUNT);
    const receipt1 = await borrowTx1.wait();
    const borrowEvt1 = receipt1.logs
        .map((l) => { try { return lending.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "Borrow");
    console.log(`\n  ✓ Strong borrower borrowed ${E(BORROW_AMOUNT)} ETH with ratio ${borrowEvt1?.args?.collateralRatioApplied}%`);

    // Repay
    const repayTx1 = await lending.connect(strongBorrower).repay({ value: BORROW_AMOUNT });
    await repayTx1.wait();
    console.log(`  ✓ Strong borrower repaid`);

    // ───────────────────────────────────────────────────────────────
    // SCENARIO B — WITH DIKE
    // ───────────────────────────────────────────────────────────────
    console.log("\n┌───────────────────────────────────────────────┐");
    console.log("│  SCENARIO B: With DIKE (useDIKE = true)       │");
    console.log("└───────────────────────────────────────────────┘");

    const toggleTx = await lending.connect(owner).toggleDIKE(true);
    await toggleTx.wait();
    console.log("\n  DIKE enabled.");

    const ratioStrong_DIKE = await lending.getRequiredRatioFor(strongBorrower.address);
    const ratioWeak_DIKE = await lending.getRequiredRatioFor(weakBorrower.address);
    const collStrong_DIKE = await lending.getRequiredCollateral(strongBorrower.address, BORROW_AMOUNT);
    const collWeak_DIKE = await lending.getRequiredCollateral(weakBorrower.address, BORROW_AMOUNT);

    console.log(`\n  Strong Borrower | ratio: ${ratioStrong_DIKE}% | required collateral: ${E(collStrong_DIKE)} ETH`);
    console.log(`  Weak   Borrower | ratio: ${ratioWeak_DIKE}%   | required collateral: ${E(collWeak_DIKE)} ETH`);
    console.log(`\n  → Strong borrower needs only 1.1 ETH collateral (saves 0.4 ETH!)`);
    console.log(`  → Weak   borrower still needs 1.5 ETH collateral`);

    // ── Strong borrower borrows at 110% ────────────────────────────
    // They already deposited 1.5 ETH, balance after repay is still 1.5 ETH
    const borrowTx2 = await lending.connect(strongBorrower).borrow(BORROW_AMOUNT);
    const receipt2 = await borrowTx2.wait();
    const borrowEvt2 = receipt2.logs
        .map((l) => { try { return lending.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "Borrow");
    console.log(`\n  ✓ Strong borrower borrowed ${E(BORROW_AMOUNT)} ETH at ratio ${borrowEvt2?.args?.collateralRatioApplied}%`);
    const repayTx2 = await lending.connect(strongBorrower).repay({ value: BORROW_AMOUNT });
    await repayTx2.wait();

    // ── Weak borrower deposits & borrows at 150% ───────────────────
    const depositTx3 = await lending.connect(weakBorrower).depositCollateral({ value: W("1.5") });
    await depositTx3.wait();
    const borrowTx3 = await lending.connect(weakBorrower).borrow(BORROW_AMOUNT);
    const receipt3 = await borrowTx3.wait();
    const borrowEvt3 = receipt3.logs
        .map((l) => { try { return lending.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "Borrow");
    console.log(`  ✓ Weak borrower  borrowed ${E(BORROW_AMOUNT)} ETH at ratio ${borrowEvt3?.args?.collateralRatioApplied}%`);
    const repayTx3 = await lending.connect(weakBorrower).repay({ value: BORROW_AMOUNT });
    await repayTx3.wait();

    // ───────────────────────────────────────────────────────────────
    // SUMMARY
    // ───────────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  SUMMARY");
    console.log("══════════════════════════════════════════════════════════");
    console.log("  Borrow Amount: 1 ETH");
    console.log("  ┌────────────────┬────────────┬────────────┐");
    console.log("  │ Borrower       │ w/o DIKE   │  w/ DIKE   │");
    console.log("  ├────────────────┼────────────┼────────────┤");
    console.log("  │ Strong (10/0)  │ 1.5 ETH    │ 1.1 ETH ✓  │");
    console.log("  │ Weak   (1/2)   │ 1.5 ETH    │ 1.5 ETH    │");
    console.log("  └────────────────┴────────────┴────────────┘");
    console.log("\n  Simulation complete. ✓");
    console.log("══════════════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
