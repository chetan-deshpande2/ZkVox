import { expect } from "chai";
import { ethers } from "hardhat";
import * as snarkjs from "snarkjs";
import path from "path";
const { poseidon1, poseidon2 } = require("poseidon-lite");

describe("Relayer Integration", function () {
    let verifier: any;
    let zkdao: any;
    let registry: any;
    let badge: any;
    let poseidon: any;
    let owner: any;
    let relayer: any;

    const hash = (inputs: any[]) => {
        if (inputs.length === 1) return poseidon1(inputs);
        if (inputs.length === 2) return poseidon2(inputs);
        throw new Error(`Poseidon not implemented for ${inputs.length} inputs`);
    };

    before(async function () {
        [owner, relayer] = await ethers.getSigners();

        verifier = await (await ethers.getContractFactory("Verifier")).deploy();

        // 2. Deploy Real Poseidon from Bytecode
        const poseidonArtifact = require("../build/PoseidonBytecode.json");
        const tx = await owner.sendTransaction({
            data: poseidonArtifact.bytecode
        });
        const receipt = await tx.wait();
        const poseidonAddress = receipt.contractAddress;

        poseidon = await ethers.getContractAt("Poseidon", poseidonAddress);

        badge = await (await ethers.getContractFactory("ZKVoxBadge")).deploy();
        registry = await (await ethers.getContractFactory("MembershipRegistry")).deploy(await poseidon.getAddress(), 0);

        zkdao = await (await ethers.getContractFactory("ZKDAO")).deploy(
            await verifier.getAddress(),
            await registry.getAddress(),
            await badge.getAddress()
        );

        await badge.setDAOAddress(await zkdao.getAddress());
        await zkdao.createProposal(1, "Relayer Prop", "Desc", "IPFS");
    });

    it("Should allow a third-party relayer to submit a member's vote", async function () {
        const secret = 12345n;
        const proposalId = 1n;
        const vote = 1n;

        // 1. Calculate Zeros
        const depth = 20;
        const zeros = [];
        let currentZero = 0n;
        for (let i = 0; i < depth; i++) {
            zeros.push(currentZero);
            currentZero = hash([currentZero, currentZero]);
        }

        // 2. Mock tree path
        const pathElements = [];
        const pathIndices = [];
        let commitment = hash([secret]);
        let current = commitment;

        for (let i = 0; i < depth; i++) {
            const sibling = zeros[i];
            pathElements.push(sibling);
            pathIndices.push(0);
            current = hash([current, sibling]);
        }

        const input = {
            root: current.toString(),
            nullifierHash: hash([secret, proposalId]).toString(),
            proposalId: Number(proposalId),
            secret: secret,
            pathElements: pathElements.map(e => e.toString()),
            pathIndices: pathIndices,
            vote: Number(vote)
        };

        const wasmPath = path.join(__dirname, "../build/vote_js/vote.wasm");
        const zkeyPath = path.join(__dirname, "../build/vote_final.zkey");

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

        // Register member to update registry root
        await registry.register(commitment.toString());

        const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const argv = calldata.replace(/["[\]\s]/g, "").split(",");

        const a = [argv[0], argv[1]];
        const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
        const c = [argv[6], argv[7]];
        const Input = [argv[8], argv[9], argv[10], argv[11]];

        const tx = await zkdao.connect(relayer).castVote(
            a, b, c,
            Input[1], // nullifier
            Input[2], // proposal
            Input[0], // root
            Input[3], // vote
            owner.address // badge recipient
        );

        const receipt = await tx.wait();
        expect(receipt.from).to.equal(relayer.address);
        expect(receipt.status).to.equal(1);

        const tally = await zkdao.getTally(proposalId);
        expect(tally.yes).to.equal(1n);
    });
});
