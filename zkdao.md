# Privacy-Preserving DAO Voting System — Backend & Testing Project Specification

## 1. Overview
This project focuses entirely on backend components of a privacy-preserving voting system that provides anonymous voting, verifiable results, and coercion resistance.

## 2. Architecture (Backend-Only)
### 2.1 Identity & Membership
- Merkle tree commitments
- SBT/NFT-based attestation
- Membership root stored on-chain

### 2.2 Anonymous Voting Protocol
- ZK proof of membership
- Nullifier to prevent double voting
- Validity constraints on vote options
- **Anonymity vs. Coercion Resistance**:
  - Default: **Semaphore-style** (Anonymity). Users can prove how they voted if they choose to (susceptible to coercion).
  - Advanced: **MACI-style** (Collusion Resistance). Requires an encrypted mempool and a centralized Coordinator to prevent voters from proving their vote to a briber.

### 2.3 Smart Contracts
- MembershipRegistry
- NullifierRegistry
- VoteVerifier
- ProposalManager
- (Optional) TallyCommit

### 2.4 Backend Services
- ZK prover pipeline
- Coordinator service (optional)
- Test harness automation

### 2.6 Relayer Infrastructure
- **Purpose**: Decouple gas payment from voter identity to prevent linkability.
- **Flow**: User generates Proof -> User sends Proof to Relayer (HTTPS) -> Relayer submits TX to Blockchain.
- **Incentive**: DAO subsidizes gas or Relayer is reimbursed via contract.

### 2.5 Storage
- Local DB for coordinator simulation
- File-based proof artifacts
- **Off-chain Data**: IPFS/Arweave for storing Merkle Tree leaves (to minimize on-chain state bloat).

## 3. Technologies & Tools
- **Circuits**: Circom 2.0 (Constraint System)
- **Proving System**: Groth16 (requires Trusted Setup) for minimal gas verification cost.
- **Hashing**: Poseidon (ZK-friendly hash function).
- **Alternative**: Noir/Halo2 (only if exploring recursion or avoiding trusted setup).
- Hardhat or Foundry
- Jest/Mocha, Echidna, Slither
- GitHub Actions CI

## 4. ZK Circuits
### 4.1 Membership + Nullifier Circuit
- Private inputs: identity secret, Merkle proof, vote, nullifier secret
- Public inputs: Merkle root, nullifier hash, proposal ID
- Constraints: Merkle inclusion, nullifier correctness, vote validity

### 4.2 (Optional) Tally Circuit
- Ensures encrypted votes processed correctly
- Publishes verifiable tally

## 5. Backend APIs
Coordinator (optional) and test harness endpoints listed for simulation and attack testing.

## 6. Testing Strategy
- Unit tests, integration tests, end-to-end tests
- Fuzzing and security analysis
- Performance benchmarking

## 7. Test Cases
Covers correctness, fraud handling, coercion resistance, stress tests.

## 8. Repository Structure
Suggested folder layout for contracts, circuits, tests, CI, and scripts.

## 9. Environment Setup
Prerequisites, scripts, deterministic testing guidance.

### 9.1 Trusted Setup (Powers of Tau)
- Required for Groth16.
- Phase 1: Perpetual Powers of Tau (use existing files, e.g., from Hermez or Polygon).
- Phase 2: Circuit-specific setup (generated per circuit).

## 10. CI Pipeline
Build circuits, test, fuzz, publish artifacts, benchmark.

## 11. Security Measures
Circuit and contract audits, static analysis, fuzzing, threat model.

## 12. Sprint Plan
6 sprints covering setup, circuits, contracts, coordinator, security, CI/docs.

## 13. Example Test Flow (Pseudo-code)
Demonstrates E2E flow of identity generation, Merkle registration, proof creation, vote submission, and tally verification.

## 14. Deliverables
Circuits, contracts, backend services, CI pipeline, security and performance reports, docs.

