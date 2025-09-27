import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

/**
 * Generate or load a funded keypair for Walrus operations
 * In production, this should be replaced with proper key management
 */
export async function getFundedKeypair() {
    // For demo purposes, we'll generate a new keypair
    // In production, you should load from secure storage
    const keypair = new Ed25519Keypair();
    
    const client = new SuiClient({ url: getFullnodeUrl('testnet') });
    
    // Check if the keypair has funds
    try {
        const balance = await client.getBalance({
            owner: keypair.toSuiAddress(),
        });
        
        if (BigInt(balance.totalBalance) < BigInt('100000000')) { // 0.1 SUI
            console.warn('⚠️  Keypair has insufficient funds for Walrus operations');
            console.log('💰 Address:', keypair.toSuiAddress());
            console.log('🚰 Please fund this address at: https://faucet.testnet.sui.io/');
            
            // Wait for funding
            console.log('⏳ Waiting for funding... (checking every 5 seconds)');
            await waitForFunding(client, keypair.toSuiAddress());
        }
        
        console.log('✅ Keypair is funded and ready');
        return keypair;
        
    } catch (error) {
        console.error('Error checking balance:', error);
        return keypair;
    }
}

async function waitForFunding(client, address, amountDue = BigInt('100000000')) {
    while (true) {
        try {
            const balance = await client.getBalance({ owner: address });
            if (BigInt(balance.totalBalance) >= BigInt('100000000')) {
                console.log('✅ Address funded successfully!');
                break;
            }
        } catch (error) {
            console.error('Error checking balance:', error);
        }
        
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}