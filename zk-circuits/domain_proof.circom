pragma circom 2.0.0;

// TODO: Import required components
// include "./components/jwt_verify.circom";
// include "./components/json_parser.circom";
// include "./components/string_contains.circom";
// include "./components/address_derivation.circom";

/*
 * EmailDomainProof Circuit
 * 
 * Proves:
 * 1. JWT is valid and properly signed by OAuth provider
 * 2. Address derived from JWT (via jwtToAddress) matches expected address
 * 3. Email field in JWT contains specified domain pattern
 * 
 * Private Inputs:
 *   - jwt_header: JWT header (Base64 encoded)
 *   - jwt_payload: JWT payload (Base64 encoded JSON)
 *   - jwt_signature: JWT signature
 *   - salt: User's salt for address derivation
 * 
 * Public Inputs:
 *   - expected_address: The zkLogin address (transaction sender)
 *   - domain_pattern: The domain to verify (e.g., "@gmail.com")
 * 
 * Privacy:
 *   ✓ Full email remains private
 *   ✓ JWT remains private
 *   ✓ Salt remains private
 *   ✗ Domain pattern is public
 *   ✗ Address is public (it's the tx sender)
 */

template EmailDomainProof() {
    // ==================== PRIVATE INPUTS ====================
    signal input jwt_header[256];
    signal input jwt_payload[512];
    signal input jwt_signature[256];
    signal input salt;
    
    // ==================== PUBLIC INPUTS ====================
    signal input expected_address;      // The zkLogin address
    signal input domain_pattern[20];    // e.g., "@gmail.com" as ASCII bytes
    
    // ==================== CIRCUIT LOGIC ====================
    
    // Step 1: Verify JWT signature
    // TODO: Implement JWT signature verification
    // This ensures the JWT is valid and signed by OAuth provider
    
    // Step 2: Extract 'sub' field from JWT payload
    // TODO: Parse JSON and extract "sub" field
    // This is used for address derivation
    signal jwt_sub[32];
    
    // Step 3: Extract 'email' field from JWT payload
    // TODO: Parse JSON and extract "email" field
    signal email[64];
    
    // Step 4: Compute zkLogin address
    // TODO: Implement address = hash(sub, salt)
    // This must match the jwtToAddress function in Sui
    signal computed_address;
    
    // Step 5: Verify computed address matches expected address
    computed_address === expected_address;
    
    // Step 6: Verify email contains domain pattern
    // TODO: Implement substring matching
    // Check that email contains domain_pattern
    signal contains_domain;
    contains_domain === 1;  // Must contain the domain
}

// Compile this circuit with:
// circom domain_proof.circom --r1cs --wasm --sym
component main {public [expected_address, domain_pattern]} = EmailDomainProof();
