import { ethers } from "hardhat";

async function main() {
    const [deployer, user] = await ethers.getSigners();

    // Deploy Registry
    const DIKERegistryFactory = await ethers.getContractFactory("DIKERegistry");
    const registry = await DIKERegistryFactory.deploy(deployer.address);
    await registry.waitForDeployment();

    const amount = ethers.parseUnits("100", 18);

    // 1. Borrow Event
    const borrowRef = ethers.id("borrow");
    const borrowTx = await registry.recordEvent(user.address, amount, 0n, borrowRef); // 0 = BORROW
    const borrowReceipt = await borrowTx.wait();

    // 2. Repay Event
    const repayRef = ethers.id("repay");
    const repayTx = await registry.recordEvent(user.address, amount, 1n, repayRef); // 1 = REPAY_ON_TIME
    const repayReceipt = await repayTx.wait();

    // 3. Default Event
    const defaultRef = ethers.id("default");
    const defaultTx = await registry.recordEvent(user.address, amount, 3n, defaultRef); // 3 = DEFAULT
    const defaultReceipt = await defaultTx.wait();

    // Output JSON strictly
    const output = {
        borrowGas: Number(borrowReceipt?.gasUsed),
        repayGas: Number(repayReceipt?.gasUsed),
        defaultGas: Number(defaultReceipt?.gasUsed)
    };

    console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
