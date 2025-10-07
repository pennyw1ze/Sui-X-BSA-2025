/**
 * Domain Proof Generator
 * 
 * Generates zero-knowledge proofs that:
 * 1. A JWT derives to a specific Sui address (via jwtToAddress)
 * 2. The email in that JWT contains a specific domain pattern
 * 
 * All while keeping the full email and JWT private!
 */

/**
 * Generate a domain proof
 * 
 * @param {Object} params
 * @param {string} params.jwt - The JWT token (kept private in proof)
 * @param {string} params.salt - User's salt (kept private in proof)
 * @param {string} params.expectedAddress - The zkLogin address to verify
 * @param {string} params.domainPattern - Domain to prove (e.g., "@gmail.com")
 * @returns {Promise<{proof: Uint8Array, publicInputs: Object}>}
 */
export async function generateDomainProof({ jwt, salt, expectedAddress, domainPattern }) {
  console.debug('[DomainProver] Generating domain proof for:', domainPattern);
  
  // TODO: Implement proof generation
  // Option A: Call backend proof service
  // Option B: Use WASM circuit in browser
  
  try {
    // For now, this is a placeholder
    // Replace with actual proof generation when circuit is ready
    
    const response = await fetch('/api/prove-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jwt,              // Private input
        salt,             // Private input
        expectedAddress,  // Public output
        domainPattern,    // Public output
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Proof generation failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      proof: new Uint8Array(result.proof),
      publicInputs: {
        address: result.address,
        domain: result.domain,
      },
    };
  } catch (error) {
    console.error('[DomainProver] Failed to generate proof:', error);
    throw error;
  }
}

/**
 * Generate domain proof using client-side WASM (when available)
 * 
 * @param {Object} params - Same as generateDomainProof
 * @returns {Promise<{proof: Uint8Array, publicInputs: Object}>}
 */
export async function generateDomainProofWASM({ jwt, salt, expectedAddress, domainPattern }) {
  console.debug('[DomainProver] Generating proof using WASM...');
  
  // TODO: Implement when circuit is compiled to WASM
  // const snarkjs = await import('snarkjs');
  
  // Parse JWT
  const [header, payload, signature] = jwt.split('.');
  
  // Prepare circuit inputs
  const inputs = {
    // Private inputs
    jwt_header: stringToSignals(header),
    jwt_payload: stringToSignals(payload),
    jwt_signature: signatureToSignals(signature),
    salt: BigInt(salt),
    
    // Public inputs
    expected_address: addressToSignal(expectedAddress),
    domain_pattern: stringToSignals(domainPattern),
  };
  
  // Generate witness and proof
  // const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  //   inputs,
  //   '/domain_proof.wasm',
  //   '/domain_final.zkey'
  // );
  
  // return {
  //   proof: new Uint8Array(proof),
  //   publicInputs: {
  //     address: publicSignals[0],
  //     domain: publicSignals[1],
  //   },
  // };
  
  throw new Error('WASM proof generation not yet implemented');
}

/**
 * Verify a domain proof (for testing)
 * 
 * @param {Uint8Array} proof - The proof to verify
 * @param {Object} publicInputs - Public inputs used in proof
 * @returns {Promise<boolean>}
 */
export async function verifyDomainProof(proof, publicInputs) {
  console.debug('[DomainProver] Verifying domain proof...');
  
  // TODO: Implement verification
  // This would use the verification key to check the proof
  
  // const snarkjs = await import('snarkjs');
  // const vKey = await fetch('/verification_key.json').then(r => r.json());
  // 
  // const isValid = await snarkjs.groth16.verify(
  //   vKey,
  //   [publicInputs.address, publicInputs.domain],
  //   proof
  // );
  
  // return isValid;
  
  throw new Error('Verification not yet implemented');
}

// ===== Helper Functions =====

function stringToSignals(str) {
  // Convert string to array of ASCII values
  const bytes = new TextEncoder().encode(str);
  return Array.from(bytes);
}

function signatureToSignals(sig) {
  // Decode base64url signature
  const decoded = atob(sig.replace(/-/g, '+').replace(/_/g, '/'));
  return Array.from(decoded).map(c => c.charCodeAt(0));
}

function addressToSignal(address) {
  // Convert Sui address to circuit signal
  // Address is 32 bytes in hex format: "0x1234..."
  const hex = address.startsWith('0x') ? address.slice(2) : address;
  return BigInt('0x' + hex);
}

/**
 * Mock proof generator for development/testing
 * Use this while circuit is being developed
 */
export function generateMockDomainProof({ expectedAddress, domainPattern }) {
  console.warn('[DomainProver] Using MOCK proof - not cryptographically secure!');
  
  return {
    proof: new Uint8Array(256).fill(0), // Fake proof
    publicInputs: {
      address: expectedAddress,
      domain: domainPattern,
    },
    isMock: true,
  };
}
