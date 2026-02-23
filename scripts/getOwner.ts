import { ethers } from "hardhat";
async function main() {
    const registry = await ethers.getContractAt("DIKERegistry", "0x2D54be78A430792ed9ed1024f5e625C031E2ebB4");
    const owner = await registry.owner();
    console.log("Current DIKERegistry Owner (Bridge Address):", owner);
}
main().catch(console.error);
