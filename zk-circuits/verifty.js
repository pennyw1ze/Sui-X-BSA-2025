const snarkjs = require('snarkjs')
const fs = require("fs");

async function verify(){
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { secret: 12345 }, 
    "domain_proof_js/domain_proof.wasm", 
    "circuit_0000.zkey");


    const vKey = JSON.parse(fs.readFileSync("verification_key.json"));
    const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      if (res === true) {
        console.log("Verification OK");
      } else {
        console.log("Invalid proof");
      }
}
verify()

verify().then(() => {
    process.exit(0);
});