import { ethers, network } from "hardhat";

/**
 * Main deployment script for the ZK DAO contracts.
 * 
 * Usage:
 * bun run hardhat run scripts/deploy.ts --network <network_name>
 */
async function main() {
    console.log(">> Starting deployment process...");

    // 1. Deploy the Verifier (Generated from snarkjs)
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log(`✅ Verifier deployed to: ${verifierAddress}`);

    // 2. Deploy the ZKDAO Contract
    // Initial Merkle Root is set to 0 for the MVP.
    // In production, this would be initialized with the starting membership tree root.
    const initialRoot = 0;
    const ZKDAO = await ethers.getContractFactory("ZKDAO");
    const zkdao = await ZKDAO.deploy(verifierAddress, initialRoot);
    await zkdao.waitForDeployment();
    const zkdaoAddress = await zkdao.getAddress();

    console.log(`✅ ZKDAO deployed to: ${zkdaoAddress}`);
    console.log("\n--------------------------------------------------");
    console.log("Deployment Summary:");
    console.log(`- Network: ${network.name}`);
    console.log(`- Verifier: ${verifierAddress}`);
    console.log(`- ZKDAO: ${zkdaoAddress}`);
    console.log("--------------------------------------------------\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
