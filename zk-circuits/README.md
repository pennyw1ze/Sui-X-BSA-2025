# ZK Domain Proof Circuits

This directory contains the Circom circuits for generating zero-knowledge proofs of email domain verification.

## Overview

The circuit proves that a JWT token:
1. Derives to a specific Sui address (via `jwtToAddress`)
2. Contains an email with a specific domain (e.g., "@gmail.com")

All while keeping the full email address and JWT private!

## Circuit Structure

```
zk-circuits/
├── domain_proof.circom          # Main circuit
├── components/
│   ├── jwt_verify.circom        # JWT signature verification
│   ├── json_parser.circom       # Extract fields from JSON
│   ├── string_contains.circom   # Substring matching
│   └── address_derivation.circom # Compute zkLogin address
└── test/
    └── domain_proof.test.js     # Circuit tests
```

## Setup

### Install Dependencies

```bash
# Install Circom compiler
curl -L https://github.com/iden3/circom/releases/latest/download/circom-linux-amd64 -o /usr/local/bin/circom
chmod +x /usr/local/bin/circom

# Install snarkjs
npm install -g snarkjs

# Install circomlib
npm install circomlib
```

### Compile Circuit

```bash
# Compile to R1CS, WASM, and symbols
circom domain_proof.circom --r1cs --wasm --sym --output build/

# View circuit info
snarkjs r1cs info build/domain_proof.r1cs
```

## Trusted Setup

### Powers of Tau Ceremony

```bash
# Start new ceremony (12 = 2^12 constraints)
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v

# Contribute randomness
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau \
  --name="First contribution" -v

# Add more contributions (recommended for production)
snarkjs powersoftau contribute pot12_0001.ptau pot12_0002.ptau \
  --name="Second contribution" -v

# Prepare phase 2
snarkjs powersoftau prepare phase2 pot12_0002.ptau pot12_final.ptau -v
```

### Circuit-Specific Setup

```bash
# Generate zkey
snarkjs groth16 setup build/domain_proof.r1cs pot12_final.ptau domain_0000.zkey

# Contribute to phase 2
snarkjs zkey contribute domain_0000.zkey domain_final.zkey \
  --name="Circuit contribution" -v

# Export verification key
snarkjs zkey export verificationkey domain_final.zkey verification_key.json

# Export for smart contract (Solidity format)
snarkjs zkey export solidityverifier domain_final.zkey verifier.sol
```

## Generating Proofs

### Create Input File

```json
{
  "jwt_header": [/* ASCII bytes */],
  "jwt_payload": [/* ASCII bytes */],
  "jwt_signature": [/* bytes */],
  "salt": "129390038577185583942388216820280642146",
  "expected_address": "0x1234...",
  "domain_pattern": [64, 103, 109, 97, 105, 108, 46, 99, 111, 109]
}
```

### Generate Proof

```bash
# Generate witness
node build/domain_proof_js/generate_witness.js \
  build/domain_proof_js/domain_proof.wasm \
  input.json \
  witness.wtns

# Generate proof
snarkjs groth16 prove domain_final.zkey witness.wtns proof.json public.json

# Verify proof (for testing)
snarkjs groth16 verify verification_key.json public.json proof.json
```

## Circuit Components

### 1. JWT Verification

Verifies the JWT signature using the OAuth provider's public key.

```circom
component jwt_verifier = VerifyJWT();
jwt_verifier.header <== jwt_header;
jwt_verifier.payload <== jwt_payload;
jwt_verifier.signature <== jwt_signature;
jwt_verifier.valid === 1;
```

### 2. JSON Parsing

Extracts specific fields from the JWT payload.

```circom
component email_extractor = ExtractJSONField(512, "email");
email_extractor.json <== jwt_payload;
signal email[64] <== email_extractor.value;
```

### 3. String Contains

Checks if email contains the domain pattern.

```circom
component domain_check = StringContains(64, 20);
domain_check.haystack <== email;
domain_check.needle <== domain_pattern;
domain_check.found === 1;
```

### 4. Address Derivation

Computes the zkLogin address from sub and salt.

```circom
component addr_computer = ComputeZkLoginAddress();
addr_computer.jwt_sub <== jwt_sub;
addr_computer.salt <== salt;
signal computed_address <== addr_computer.address;
computed_address === expected_address;
```

## Testing

```bash
# Run circuit tests
npm test

# Test with sample inputs
node test/test_domain_proof.js
```

## Deployment

### For Backend Service

1. Copy `domain_final.zkey` to backend
2. Copy `verification_key.json` to backend
3. Use snarkjs to generate proofs server-side

### For Client-Side (WASM)

1. Copy `build/domain_proof_js/domain_proof.wasm` to `frontend/public/`
2. Copy `domain_final.zkey` to `frontend/public/`
3. Import snarkjs in frontend
4. Generate proofs in browser

### For Smart Contract

1. Deploy verification key on-chain
2. Use Sui's `groth16::verify_groth16_proof` to verify proofs

## Security Considerations

1. **Trusted Setup**: Ensure multiple independent contributors
2. **Circuit Security**: Audit for under-constrained circuits
3. **Key Management**: Protect zkey files
4. **Input Validation**: Validate all inputs before proof generation

## Resources

- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS Guide](https://github.com/iden3/snarkjs)
- [ZK Security Best Practices](https://zksecurity.github.io/stark-book/)
- [Sui Groth16 Docs](https://docs.sui.io/concepts/cryptography/groth16)

## Status

- [ ] JWT verification component
- [ ] JSON parser component
- [ ] String contains component
- [ ] Address derivation component
- [ ] Main circuit integration
- [ ] Trusted setup ceremony
- [ ] Testing suite
- [ ] Production deployment

---

**Note**: This is a work in progress. Circuit implementation is ongoing.
