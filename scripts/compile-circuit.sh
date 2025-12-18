#!/bin/bash
# -----------------------------------------------------------------------------
# ZK-DAO Circuit Builder
# -----------------------------------------------------------------------------
# This script handles the end-to-end compilation of our Circom circuits,
# generates the cryptographic keys, and exports the Solidity verifier.
# -----------------------------------------------------------------------------

set -e # Exit immediately if a command fails.

# 1. Compile the circuit to R1CS and WASM
echo ">> Compiling vote.circom..."
mkdir -p build
./bin/circom circuits/vote.circom --r1cs --wasm --sym --output build

# 2. Phase 1: Setup Powers of Tau
# We use a power of 15 to ensure we have enough constraints for the Merkle tree.
if [ ! -f build/pot15_final.ptau ]; then
    echo ">> Generating Powers of Tau (Phase 1)..."
    bun run snarkjs powersoftau new bn128 15 build/pot15_0000.ptau -v
    bun run snarkjs powersoftau contribute build/pot15_0000.ptau build/pot15_0001.ptau --name="Dev Contribution" -v -e="some randomness"
    bun run snarkjs powersoftau prepare phase2 build/pot15_0001.ptau build/pot15_final.ptau -v
fi

# 3. Phase 2: Create circuit keys and export Verifier
echo ">> Generating Groth16 keys (Phase 2)..."
bun run snarkjs groth16 setup build/vote.r1cs build/pot15_final.ptau build/vote_0000.zkey
bun run snarkjs zkey contribute build/vote_0000.zkey build/vote_final.zkey --name="Dev Contribution" -v -e="more randomness"

# Export the verification key (for JS) and the Solidity contract (for EVM)
bun run snarkjs zkey export verificationkey build/vote_final.zkey build/verification_key.json
bun run snarkjs zkey export solidityverifier build/vote_final.zkey contracts/Verifier.sol

# Note: snarkjs generates the contract with the name Groth16Verifier.
# We rename it to 'Verifier' to keep our deployment scripts clean.
sed -i '' 's/contract Groth16Verifier/contract Verifier/g' contracts/Verifier.sol

echo ">> ✅ Done! Artifacts are in build/ and contracts/Verifier.sol is ready."
