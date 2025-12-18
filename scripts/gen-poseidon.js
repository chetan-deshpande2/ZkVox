const { poseidonContract } = require("circomlibjs");
const fs = require("fs");
const path = require("path");

function main() {
    const bytecode = poseidonContract.createCode(2);
    const outputPath = path.join(__dirname, "../build/PoseidonBytecode.json");
    
    // Create build directory if it doesn't exist
    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify({ bytecode }, null, 2));
    console.log(`✅ Poseidon bytecode saved to ${outputPath}`);
}

main();
