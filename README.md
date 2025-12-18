# ZK DAO: Privacy-Preserving Voting System 🛡️🗳️

A robust, production-hardened ZK-SNARK voting system that allows DAO members to vote anonymously on proposals. It uses Merkle trees for membership verification and nullifiers to prevent double-voting.

## 🚀 Key Features

- **Anonymous Voting**: Prove membership in a 1M-member tree without revealing your identity.
- **Relayer Infrastructure**: Decouples user wallets from on-chain votes to maintain total privacy.
- **Security Hardened**: Includes scalar field overflow protection and strict circuit-level constraints.
- **Human-Centric Code**: Well-documented, clean code following best practices for ZK development.
- **Comprehensive Tests**: 8+ end-to-end tests covering valid votes, tampered proofs, and relayer integration.

## 🛠️ Tech Stack

- **ZK Circuits**: [Circom 2.1+](https://docs.circom.io/)
- **Proving System**: [SnarkJS](https://github.com/iden3/snarkjs) (Groth16)
- **Hashing**: Poseidon (Optimized for ZK)
- **Smart Contracts**: Solidity 0.8.20+
- **Dev Environment**: Hardhat + [Bun](https://bun.sh/)
- **Libraries**: OpenZeppelin, Poseidon-Lite

## 📂 Project Structure

```text
.
├── circuits/           # ZK-SNARK Circom circuits
├── contracts/          # Solidity smart contracts
├── scripts/            # Compilation, Deployment, and Relayer scripts
├── test/               # Comprehensive test suite (Unit & Integration)
├── build/              # Generated ZK artifacts (R1CS, WASM, zkey)
├── security_review.md  # Detailed internal security audit
└── README.md           # This file
```

## ⚙️ Installation

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

## 🏗️ Development Workflow

### 1. Compile Circuits
This script handles the compilation, Powers of Tau generation, and Solidity verifier export.
```bash
./scripts/compile-circuit.sh
```

### 2. Run Tests
We have three layers of testing:
```bash
# General system tests
bun run hardhat test

# Specific layers
bun run hardhat test test/vote.test.ts      # Circuit logic
bun run hardhat test test/contracts.test.ts # On-chain logic
bun run hardhat test test/relayer.test.ts   # Relayer privacy logic
```

### 3. Deployment
Configure your `.env` file with `PRIVATE_KEY` and `RPC_URL`, then run:
```bash
bun run hardhat run scripts/deploy.ts --network <your-network>
```

## 🛰️ Relayer Infrastructure

To prevent "Privacy Leakage" (wallet address linked to the vote), use the provided relayer utility:
- **Location**: `scripts/relayer.ts`
- **Function**: Users generate proofs locally and send them to the Relayer, who submits the transaction and pays the gas.


