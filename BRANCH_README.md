# Branch: ZK-domain-proof 🔐

## What's Been Set Up

✅ **New Branch Created**: `ZK-domain-proof`

✅ **Implementation Plan**: See `DOMAIN_PROOF_IMPLEMENTATION.md`

✅ **ZK Circuit Structure**: `zk-circuits/domain_proof.circom`

✅ **Frontend Utility**: `walrus-app/frontend/src/utils/domainProver.js`

✅ **Documentation**: Circuit setup and usage guide

## Quick Start

### View the Plan

```bash
cat DOMAIN_PROOF_IMPLEMENTATION.md
```

### Directory Structure

```
Sui-X-BSA-2025/
├── DOMAIN_PROOF_IMPLEMENTATION.md  # 📋 Full implementation plan
├── zk-circuits/
│   ├── README.md                    # Circuit documentation
│   ├── domain_proof.circom          # Main ZK circuit (TODO)
│   └── components/                  # Circuit components (TODO)
└── walrus-app/
    └── frontend/
        └── src/
            └── utils/
                └── domainProver.js  # Proof generation utility
```

## What This Branch Will Implement

### The Two-Proof System

**Proof 1: Standard zkLogin** (Already exists)
- Proves you own a Sui address
- Used for transaction signing
- Already implemented in main branch

**Proof 2: Domain Verification** (NEW - this branch)
- Proves your email contains a specific domain
- Verified by smart contract
- Email remains private!

### Example Use Case

```javascript
// After zkLogin authentication
const accountData = {
    userAddr: "0x1234...",
    domain: "gmail.com",
    
    // Proof 1: For transaction signing
    zkProofs: {...},
    
    // Proof 2: For domain verification (NEW)
    domainProof: {
        proof: Uint8Array([...]),
        publicInputs: {
            address: "0x1234...",
            domain: "@gmail.com"
        }
    }
};

// Upload document with verified domain
await uploadWithDomainProof({
    title: "Whistleblower Document",
    domain: "@gmail.com",
    proof: accountData.domainProof
});

// On-chain result:
// Document {
//     title: "Whistleblower Document",
//     verified_domain: "@gmail.com",  // ✅ Cryptographically verified
//     uploader: "0x1234...",
//     is_verified: true
// }
```

## Implementation Phases

### Phase 0: Planning ✅ (DONE)
- [x] Create branch
- [x] Write implementation plan
- [x] Set up directory structure
- [x] Document architecture

### Phase 1: ZK Circuit ⏳ (NEXT)
- [ ] Implement JWT verification component
- [ ] Implement JSON parser component
- [ ] Implement string contains check
- [ ] Implement address derivation
- [ ] Integrate main circuit
- [ ] Run trusted setup

### Phase 2: Proof Generation ⏳
- [ ] Backend proof service OR
- [ ] Client-side WASM prover
- [ ] Test proof generation

### Phase 3: Frontend Integration ⏳
- [ ] Store JWT in session
- [ ] Generate domain proof on login
- [ ] Pass proof to transactions

### Phase 4: Smart Contract ⏳
- [ ] Write Move contract with Groth16 verification
- [ ] Deploy verification key
- [ ] Test on-chain verification

### Phase 5: Testing ⏳
- [ ] Unit tests for circuit
- [ ] Integration tests
- [ ] End-to-end flow test

## Next Steps

1. **Review the Plan**
   ```bash
   cat DOMAIN_PROOF_IMPLEMENTATION.md
   ```

2. **Review Circuit Template**
   ```bash
   cat zk-circuits/domain_proof.circom
   ```

3. **Start Implementation** (Choose one):
   - Full ZK Circuit (complex, cryptographically secure)
   - Simple Attestation Service (quick, requires trust)

4. **Switch Between Branches**
   ```bash
   # Work on ZK proofs
   git checkout ZK-domain-proof
   
   # Go back to main
   git checkout main
   ```

## Why This Is Important

### Current State (Main Branch)
- ✅ Anonymous uploads via zkLogin
- ✅ Privacy preserved
- ❌ No way to verify uploader's email domain

### After This Branch
- ✅ Anonymous uploads via zkLogin
- ✅ Privacy preserved
- ✅ **Cryptographically verified domain attribution**

**Example**: "This document was uploaded by a verified @company.com employee"

The uploader remains anonymous, but their email domain is verified!

## Resources

- **Implementation Plan**: `DOMAIN_PROOF_IMPLEMENTATION.md`
- **Circuit Docs**: `zk-circuits/README.md`
- **Circom Tutorial**: https://docs.circom.io/
- **Sui Groth16**: https://docs.sui.io/concepts/cryptography/groth16

## Questions?

Review the full implementation plan in `DOMAIN_PROOF_IMPLEMENTATION.md`

---

**Branch**: `ZK-domain-proof`  
**Status**: 📝 Planning Complete, Ready for Implementation  
**Goal**: Cryptographic domain verification for anonymous uploads
