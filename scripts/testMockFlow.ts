import { ethers, network } from "hardhat";

const TOKEN_ADDRESS = "0x0402edb5A734A43D2323D85Ed6a1014137b4eE43";
const PROTOCOL_ADDRESS = "0xadDc6AC70Aae77634f8F99fA95e83Da6225e597C";

async function main() {
    console.log(`\n--- Initiating MockLendingProtocol Flow on ${network.name} ---`);

    const [borrower] = await ethers.getSigners();
    console.log(`Borrower Domain: ${borrower.address}\n`);

    const token = await ethers.getContractAt("MockToken", TOKEN_ADDRESS, borrower);
    const protocol = await ethers.getContractAt("MockLendingProtocol", PROTOCOL_ADDRESS, borrower);

    // 1. Borrow 1000 tokens
    const borrowAmount = ethers.parseUnits("1000", 18);
    console.log(`[Tx 1] Borrowing ${ethers.formatUnits(borrowAmount, 18)} mUSD...`);
    const borrowTx = await protocol.borrow(borrowAmount);
    const borrowReceipt = await borrowTx.wait();

    // Parse LoanBorrowed event
    let loanId: bigint | null = null;
    if (borrowReceipt && borrowReceipt.logs) {
        for (const log of borrowReceipt.logs) {
            if (log instanceof ethers.EventLog && log.eventName === "LoanBorrowed") {
                loanId = log.args[1] as bigint;
                console.log(`  => ✅ LoanBorrowed Event Emitted`);
                console.log(`     Borrower: ${log.args[0]}`);
                console.log(`     Loan ID:  ${loanId.toString()}`);
                console.log(`     Amount:   ${ethers.formatUnits(log.args[2], 18)} mUSD`);
                break;
            }
        }
    }

    if (loanId === null) {
        console.error(`❌ Failed to retrieve Loan ID from events`);
        return;
    }

    // 2. Approve protocol for repayment
    console.log(`\n[Tx 2] Approving protocol to transfer ${ethers.formatUnits(borrowAmount, 18)} mUSD...`);
    const approveTx = await token.approve(PROTOCOL_ADDRESS, borrowAmount);
    await approveTx.wait();
    console.log(`  => ✅ Approval Confirmed`);

    // 3. Repay loan
    console.log(`\n[Tx 3] Repaying Loan ID: ${loanId.toString()}...`);
    const repayTx = await protocol.repay(loanId);
    const repayReceipt = await repayTx.wait();

    // 4. Listen for LoanRepaid event
    if (repayReceipt && repayReceipt.logs) {
        for (const log of repayReceipt.logs) {
            if (log instanceof ethers.EventLog && log.eventName === "LoanRepaid") {
                console.log(`  => ✅ LoanRepaid Event Emitted`);
                console.log(`     Borrower:  ${log.args[0]}`);
                console.log(`     Loan ID:   ${log.args[1].toString()}`);
                console.log(`     Amount:    ${ethers.formatUnits(log.args[2], 18)} mUSD`);
                console.log(`     Timestamp: ${log.args[3].toString()}`);
                break;
            }
        }
    }

    console.log(`\n======================================`);
    console.log(`Simulation complete! All transactions successfully recorded.`);
    console.log(`======================================\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
