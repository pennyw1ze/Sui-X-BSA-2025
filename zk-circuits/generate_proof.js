const snarkjs = require('snarkjs')

async function generateProof(){
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { secret: 12345 }, 
    "domain_proof_js/domain_proof.wasm", 
    "circuit_0000.zkey");
  console.log(publicSignals);
  console.log(proof);
}

generateProof()

generateProof().then(() => {
    process.exit(0);
});