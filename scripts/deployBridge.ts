import { ethers, network } from "hardhat";

const REGISTRY_ADDRESS = "0x2D54be78A430792ed9ed1024f5e625C031E2ebB4";

async function main() {
    console.log(`\n--- Deploying DIKEUSCBridge to ${network.name} ---`);

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer Domain: ${deployer.address}`);

    const factory = await ethers.getContractFactory("DIKEUSCBridge");
    console.log(`Deploying Bridge linked to Registry: ${REGISTRY_ADDRESS}...`);

    const bridge = await factory.deploy(REGISTRY_ADDRESS);
    await bridge.waitForDeployment();

    const bridgeAddress = await bridge.getAddress();

    console.log(`\n======================================`);
    console.log(`DIKEUSCBridge deployed to: ${bridgeAddress}`);
    console.log(`Linked DIKERegistry:       ${REGISTRY_ADDRESS}`);
    console.log(`======================================\n`);

    console.log(`--- Transferring Registry Ownership ---`);

    const registry = await ethers.getContractAt("DIKERegistry", REGISTRY_ADDRESS, deployer);

    console.log(`Initiating transfer of DIKERegistry ownership to DIKEUSCBridge...`);
    const tx = await registry.transferOwnership(bridgeAddress);
    await tx.wait();

    const newOwner = await registry.owner();

    if (newOwner === bridgeAddress) {
        console.log(`✅ Ownership transfer confirmed! Registry is now owned by: ${newOwner}`);
    } else {
        console.error(`❌ Ownership transfer failed! Current Owner: ${newOwner}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
