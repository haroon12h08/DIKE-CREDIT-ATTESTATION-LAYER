import { ethers, network } from "hardhat";

async function main() {
    console.log(`\n--- Deploying Mock Protocol Infrastructure to ${network.name} ---`);

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer Domain: ${deployer.address}`);

    // 1. Deploy MockToken
    const initialSupply = ethers.parseUnits("1000000", 18); // 1 million mUSD
    const tokenFactory = await ethers.getContractFactory("MockToken");
    console.log(`Deploying MockToken with supply: 1000000 mUSD...`);

    const token = await tokenFactory.deploy(initialSupply);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    // 2. Deploy MockLendingProtocol
    const protocolFactory = await ethers.getContractFactory("MockLendingProtocol");
    console.log(`Deploying MockLendingProtocol linked to token: ${tokenAddress}...`);

    const protocol = await protocolFactory.deploy(tokenAddress);
    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();

    // 3. Fund protocol with tokens
    const fundAmount = ethers.parseUnits("500000", 18); // Fund with 500k mUSD
    console.log(`Funding protocol with 500000 mUSD...`);

    const approveTx = await token.approve(protocolAddress, fundAmount);
    await approveTx.wait();

    const fundTx = await protocol.fund(fundAmount);
    await fundTx.wait();

    console.log(`\n======================================`);
    console.log(`Infrastructure Deployed!`);
    console.log(`MockToken Address:       ${tokenAddress}`);
    console.log(`MockLending Address:     ${protocolAddress}`);
    console.log(`======================================\n`);

    // 4. Log initial balances
    const deployerBalance = await token.balanceOf(deployer.address);
    const protocolBalance = await token.balanceOf(protocolAddress);

    console.log(`--- Initial Balances ---`);
    console.log(`Deployer mUSD Balance: ${ethers.formatUnits(deployerBalance, 18)} mUSD`);
    console.log(`Protocol mUSD Balance: ${ethers.formatUnits(protocolBalance, 18)} mUSD`);
    console.log(`-------------------------\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
