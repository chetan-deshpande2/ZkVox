import { expect } from "chai";
import { ethers } from "hardhat";
import * as snarkjs from "snarkjs";
import path from "path";
const { poseidon1, poseidon2 } = require("poseidon-lite");

describe("Relayer Integration", function () {
    let verifier: any;
    let zkdao: any;
    let owner: any;
    let relayer: any;

    const hash = (inputs: any[]) => {
        if (inputs.length === 1) return poseidon1(inputs);
        if (inputs.length === 2) return poseidon2(inputs);
        throw new Error(`Poseidon not implemented for ${inputs.length} inputs`);
    };

    before(async function () {
        [owner, relayer] = await ethers.getSigners();

        // 1. Deploy Verifier
        const Verifier = await ethers.getContractFactory("Verifier");
        verifier = await Verifier.deploy();
        await verifier.waitForDeployment();

        // 2. Deploy ZKDAO
        const ZKDAO = await ethers.getContractFactory("ZKDAO");
        zkdao = await ZKDAO.deploy(await verifier.getAddress(), 0);
        await zkdao.waitForDeployment();
    });

    it("Should allow a third-party relayer to submit a member's vote", async function () {
        const depth = 20;
        const secret = 12345n;
        const proposalId = 1n;
        const vote = 1n;

        // Generate membership proof data
        const pathElements = [];
        const pathIndices = [];
        let current = hash([secret]);

        for (let i = 0; i < depth; i++) {
            const sibling = BigInt(i + 100);
            pathElements.push(sibling);
            pathIndices.push(0);
            current = hash([current, sibling]);
        }

        const root = current.toString();
        const nullifierHash = hash([secret, proposalId]).toString();

        const input = {
            root: root,
            nullifierHash: nullifierHash,
            proposalId: Number(proposalId),
            secret: secret,
            pathElements: pathElements.map(e => e.toString()),
            pathIndices: pathIndices,
            vote: Number(vote)
        };

        const wasmPath = path.join(__dirname, "../build/vote_js/vote.wasm");
        const zkeyPath = path.join(__dirname, "../build/vote_final.zkey");

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

        // Update DAO root to match this voter
        await zkdao.updateRoot(publicSignals[0]);

        // Format data for contract call
        const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const argv = calldata.replace(/["[\]\s]/g, "").split(",");

        const a = [argv[0], argv[1]];
        const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
        const c = [argv[6], argv[7]];
        const Input = [argv[8], argv[9], argv[10], argv[11]];

        // HERE IS THE KEY: The transaction is sent by 'relayer', NOT 'owner'
        const tx = await zkdao.connect(relayer).castVote(
            a, b, c,
            Input[1], // nullifier
            Input[2], // proposal
            Input[0], // root
            Input[3]  // vote
        );

        const receipt = await tx.wait();
        console.log(`\n⛽ RELAYED GAS: ${receipt.gasUsed.toString()} gas`);

        expect(receipt.from).to.equal(relayer.address);
        expect(receipt.status).to.equal(1);

        // Verify vote was recorded
        expect(await zkdao.yesVotes(proposalId)).to.equal(1n);
    });
});
