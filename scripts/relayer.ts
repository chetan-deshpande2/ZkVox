import { ethers } from "ethers";
import * as snarkjs from "snarkjs";


/**
 * A sample Relayer Service script.
 * In a real-world scenario, this would be an Express server or similar.
 */
export async function relayVote(
    contractAddress: string,
    proof: any,
    publicSignals: any,
    relayerPrivateKey: string,
    rpcUrl: string
) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(relayerPrivateKey, provider);

    // ABI for the castVote function
    const abi = [
        "function castVote(uint[2] a, uint[2][2] b, uint[2] c, uint nullifierHash, uint proposalId, uint root, uint vote) external"
    ];

    const daoContract = new ethers.Contract(contractAddress, abi, wallet);

    // Format the proof data for Solidity
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const argv = calldata.replace(/["[\]\s]/g, "").split(",");

    const a = [argv[0], argv[1]];
    const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
    const c = [argv[6], argv[7]];
    const Input = [argv[8], argv[9], argv[10], argv[11]];

    console.log(`[Relayer] Submitting vote for proposal ${Input[2]}...`);

    try {
        const tx = await daoContract.castVote(
            a, b, c,
            Input[1], // nullifier
            Input[2], // proposalId
            Input[0], // root
            Input[3]  // vote
        );

        const receipt = await tx.wait();
        console.log(`[Relayer] Vote submitted successfully! Tx: ${receipt.hash}`);
        return receipt;
    } catch (error: any) {
        console.error(`[Relayer] Failed to submit vote: ${error.message}`);
        throw error;
    }
}
