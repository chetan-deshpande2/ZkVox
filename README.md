# ZK DAO: Privacy-Preserving Voting System 

A robust, production-hardened ZK-SNARK voting system that allows DAO members to vote anonymously on proposals. It features an on-chain membership registry, soulbound rewards, and rich proposal metadata.

##  Key Features

- ** ZK Privacy**: Anonymous membership (1M+ members), double-voting prevention (nullifiers), and relayer-ready architecture.
- ** On-Chain Governance**: Automated Incremental Merkle Tree registry, rich metadata (titles, descriptions, IPFS), and proposal closure.
- ** Participation Rewards**: Soulbound NFT badges (ZKVoxBadge) with privacy-preserving reward addresses.
- ** Security Hardened**: BN128 scalar field protection, Merkle root history tracking, and 18 comprehensive integration tests.

##  Tech Stack

- **ZK Circuits**: [Circom 2.1+](https://docs.circom.io/)
- **Proving System**: [SnarkJS](https://github.com/iden3/snarkjs) (Groth16)
- **Hashing**: Poseidon (Optimized for ZK)
- **Smart Contracts**: Solidity 0.8.20+ (OpenZeppelin)
- **Dev Environment**: Hardhat + [Bun](https://bun.sh/)

##  Project Structure

```text
.
├── circuits/           # ZK-SNARK Circom circuits
├── contracts/          # Solidity smart contracts
│   ├── interfaces/     # Modular contract interfaces
│   ├── ZKDAO.sol       # Main governance logic
│   ├── MembershipRegistry.sol # On-chain Merkle tree
│   └── ZKVoxBadge.sol  # Soulbound reward NFT
├── scripts/            # Compilation, Deployment, and Relayer scripts
├── test/               # Comprehensive test suite (Unit & Integration)
├── build/              # Generated ZK artifacts (R1CS, WASM, zkey)
└── README.md           # This file
```

##  Installation

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd zk-dao
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Check Circom installation**:
   Ensure you have the `circom` binary in your path or inside the `bin/` folder.

##  Development Workflow

### 1. Compile Circuits
This script handles the compilation, Powers of Tau generation, and Solidity verifier export.
```bash
./scripts/compile-circuit.sh
```

### 2. Run Tests
We have four layers of testing:
```bash
# Run all 18 tests
bun run hardhat test

# Specific layers
bun run hardhat test test/vote.test.ts       # Circuit logic
bun run hardhat test test/contracts.test.ts  # On-chain integration
bun run hardhat test test/relayer.test.ts    # Relayer privacy
bun run hardhat test test/governance.test.ts # Membership & NFT logic
```

### 3. Deployment
Configure your `.env` file with `PRIVATE_KEY` and `RPC_URL`, then run:
```bash
bun run hardhat run scripts/deploy.ts --network <your-network>
```

## Relayer Infrastructure

To prevent "Privacy Leakage" (wallet address linked to the vote), use the provided relayer utility:
- **Location**: `scripts/relayer.ts`
- **Function**: Users generate proofs locally and send them to the Relayer, who submits the transaction and pays the gas.


