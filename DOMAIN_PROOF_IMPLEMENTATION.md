# ZK Domain Proof Implementation Plan

## Overview
This branch implements a zero-knowledge proof system that proves:
1. **Address Ownership**: A JWT token derives to a specific Sui address (via `jwtToAddress(jwt, salt)`)
2. **Domain Verification**: The email in that JWT contains a specific domain pattern (e.g., "@gmail.com")

All while keeping the full email address and JWT private!

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  CLIENT SIDE                             │
├─────────────────────────────────────────────────────────┤
│  1. Login via OAuth → Get JWT                           │
│  2. Generate TWO proofs:                                 │
│     a) Standard zkLogin proof (for tx signing)          │
│     b) Domain proof (for smart contract verification)   │
│  3. Store both proofs in session                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│               TRANSACTION EXECUTION                      │
├─────────────────────────────────────────────────────────┤
│  - Signed with zkLogin signature (Proof A)              │
│  - Contains domain proof as argument (Proof B)          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              SMART CONTRACT (Move)                       │
├─────────────────────────────────────────────────────────┤
│  - Verifies Groth16 domain proof                        │
│  - Checks address matches tx sender                     │
│  - Stores verified domain with document                 │
└─────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: ZK Circuit Development ⚙️

**Goal**: Create the Circom circuit that generates domain proofs

**Files to Create**:
- `zk-circuits/domain_proof.circom` - Main circuit
- `zk-circuits/components/jwt_verify.circom` - JWT signature verification
- `zk-circuits/components/json_parser.circom` - Extract fields from JSON
- `zk-circuits/components/string_contains.circom` - Check substring match
- `zk-circuits/components/address_derivation.circom` - Compute zkLogin address

**Circuit Logic**:
```circom
// Proves:
// 1. JWT is valid (signature check)
// 2. address = jwtToAddress(jwt.sub, salt)
// 3. jwt.email contains domain_pattern
// 4. address == expected_address (tx sender)

template EmailDomainProof() {
    // Private inputs (hidden)
    signal input jwt_header[256];
    signal input jwt_payload[512];
    signal input jwt_signature[256];
    signal input salt;
    
    // Public inputs (visible)
    signal input expected_address;
    signal input domain_pattern[20];  // "@gmail.com"
    
    // Verification logic...
}
```

**Commands**:
```bash
# Compile circuit
circom domain_proof.circom --r1cs --wasm --sym

# Generate trusted setup
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau
snarkjs powersoftau prepare phase2 pot12_final.ptau pot12_final.ptau
snarkjs groth16 setup domain_proof.r1cs pot12_final.ptau domain_0000.zkey
snarkjs zkey contribute domain_0000.zkey domain_final.zkey
snarkjs zkey export verificationkey domain_final.zkey verification_key.json
```

### Phase 2: Proof Generation Service 🔐

**Goal**: Service to generate domain proofs from JWT + salt

**Option A: Backend Service**

**Files to Create**:
- `walrus-app/backend/domain-prover/index.js`
- `walrus-app/backend/domain-prover/prover.js`

**API Endpoint**:
```javascript
POST /api/prove-domain
Request:
{
  "jwt": "eyJhbGc...",      // Private
  "salt": "12939...",       // Private
  "expectedAddress": "0x1234...",
  "domainPattern": "@gmail.com"
}

Response:
{
  "proof": [/* Groth16 proof bytes */],
  "publicInputs": {
    "address": "0x1234...",
    "domain": "@gmail.com"
  }
}
```

**Option B: Client-Side WASM**

**Files to Create**:
- `walrus-app/frontend/public/domain_proof.wasm`
- `walrus-app/frontend/public/domain_final.zkey`
- `walrus-app/frontend/src/utils/domainProver.js`

### Phase 3: Frontend Integration 🎨

**Files to Modify**:
- `walrus-app/frontend/src/components/ZkLoginPill.jsx`
- `walrus-app/frontend/src/utils/uploadToSmartcontract.js`
- `walrus-app/frontend/src/WalrusUploader.jsx`

**Changes**:

1. **Store JWT token** (currently not stored):
```javascript
// In ZkLoginPill.jsx - completeZkLogin()
const accountData = {
    // ... existing fields ...
    jwt: jwt,  // ADD THIS - needed for domain proof
    domain: domain,
};
```

2. **Generate domain proof on login**:
```javascript
// After zkProofs generation
const domainProof = await generateDomainProof({
    jwt,
    salt: userSalt,
    expectedAddress: userAddr,
    domainPattern: `@${domain}`,
});

accountData.domainProof = domainProof;
```

3. **Use domain proof in transactions**:
```javascript
// In uploadToSmartcontract.js
export function createAddDocumentWithDomainProof(
    title, description, linkToBlobId, domain, domainProof
) {
    const tx = new Transaction();
    
    tx.moveCall({
        target: `${PACKAGE_ID}::documents_list::add_document_with_verified_domain`,
        arguments: [
            tx.object(DOCUMENT_LIST_ID),
            tx.object(DOMAIN_VK_ID),
            tx.pure.string(title),
            tx.pure.string(description),
            tx.pure.string(linkToBlobId),
            tx.pure.string(domain),
            tx.pure(Array.from(domainProof), 'vector<u8>'),
        ],
    });
    
    return tx;
}
```

### Phase 4: Smart Contract (Move) 📝

**Files to Create**:
- `smart-contracts/domain_verified_docs/sources/domain_verified_docs.move`
- `smart-contracts/domain_verified_docs/sources/groth16_verifier.move`
- `smart-contracts/domain_verified_docs/Move.toml`

**Smart Contract Logic**:
```move
module domain_verified_docs::documents_list {
    use sui::groth16;
    
    public struct Document has store, copy, drop {
        title: String,
        description: String,
        link: String,
        verified_domain: String,
        uploader: address,
        is_verified: bool,
    }
    
    public entry fun add_document_with_verified_domain(
        list: &mut DocumentsList,
        vk: &DomainVerificationKey,
        title: String,
        description: String,
        link: String,
        domain: String,
        proof: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Prepare public inputs
        let mut public_inputs = vector::empty<u8>();
        vector::append(&mut public_inputs, bcs::to_bytes(&sender));
        vector::append(&mut public_inputs, *string::bytes(&domain));
        
        // Verify Groth16 proof
        assert!(
            groth16::verify_groth16_proof(&vk.vk_bytes, &public_inputs, &proof),
            E_INVALID_DOMAIN_PROOF
        );
        
        // Domain is verified!
        let document = Document {
            title, description, link,
            verified_domain: domain,
            uploader: sender,
            is_verified: true,
        };
        
        vector::push_back(&mut list.documents, document);
    }
}
```

### Phase 5: Testing & Deployment 🧪

**Test Plan**:
1. Unit test circuit constraints
2. Test proof generation with sample JWTs
3. Test smart contract verification
4. End-to-end integration test

**Files to Create**:
- `zk-circuits/test/domain_proof.test.js`
- `smart-contracts/domain_verified_docs/tests/domain_verified_docs_test.move`
- `walrus-app/frontend/src/utils/__tests__/domainProver.test.js`

## Dependencies

### New Dependencies to Add:

**Frontend**:
```json
{
  "snarkjs": "^0.7.0",
  "circomlibjs": "^0.1.7"
}
```

**Backend (if using backend prover)**:
```json
{
  "snarkjs": "^0.7.0",
  "circomlib": "^2.0.5"
}
```

**Build Tools**:
```bash
npm install -g circom
npm install -g snarkjs
```

## Security Considerations

1. **Trusted Setup**: The Powers of Tau ceremony must be done securely
2. **JWT Storage**: JWT tokens in session storage - consider encryption
3. **Proof Generation**: Ensure prover service doesn't log private inputs
4. **Verification Key**: Deploy VK securely to smart contract
5. **Replay Protection**: Consider adding timestamps/nonces to proofs

## Privacy Analysis

**What Remains Private** ✓:
- Full email address (e.g., "alice@gmail.com")
- JWT token contents
- User's salt value
- All other JWT claims (name, picture, etc.)

**What Becomes Public** ✗:
- Domain pattern (e.g., "@gmail.com")
- Sui address (it's the transaction sender)
- That the email contains the domain

**Privacy Guarantee**:
"This document was uploaded by someone with a @gmail.com email, but we don't know who."

## Alternative: Simple Attestation Service (Phase 0)

For rapid prototyping, start with a trusted attestation service:

```javascript
// Backend service
POST /api/attest-domain
// Verifies JWT, signs attestation
Response: { address, domain, signature }

// Smart contract
// Verify service signature instead of ZK proof
public entry fun add_with_attested_domain(
    attestation: vector<u8>,
    signature: vector<u8>,
    ...
)
```

**Pros**: Quick to implement, works immediately
**Cons**: Requires trust in attestation service

## Next Steps

1. ✅ Create branch `ZK-domain-proof`
2. ⬜ Choose: Full ZK circuit OR Simple attestation service
3. ⬜ Set up circuit development environment
4. ⬜ Implement Phase 1 (Circuit)
5. ⬜ Implement Phase 2 (Proof generation)
6. ⬜ Implement Phase 3 (Frontend)
7. ⬜ Implement Phase 4 (Smart contract)
8. ⬜ Test end-to-end
9. ⬜ Merge to main

## Resources

- **Circom Documentation**: https://docs.circom.io/
- **SnarkJS**: https://github.com/iden3/snarkjs
- **Sui Move Docs**: https://docs.sui.io/
- **Groth16 on Sui**: https://docs.sui.io/concepts/cryptography/groth16
- **zkLogin Specs**: https://docs.sui.io/concepts/cryptography/zklogin

---

**Branch**: `ZK-domain-proof`
**Status**: 🚧 In Development
**Target**: Cryptographically verified domain attribution for anonymous document uploads
