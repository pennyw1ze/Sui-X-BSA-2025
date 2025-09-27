import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { WalrusClient } from '@mysten/walrus';

// Constants
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/gif'
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const WALRUS_TESTNET_URL = 'https://walrus-testnet.blockscope.net/v1/blobs';

// Utility Functions
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const validateFile = (file) => {
  if (!file) return { valid: false, error: 'No file selected' };
  
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Please select a valid file (PDF, DOC, DOCX, TXT, MD, JPG, PNG, GIF)' 
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  return { valid: true };
};

// Wallet Generation
export const generateNewWallet = () => {
  try {
    const newKeypair = new Ed25519Keypair();
    const newAddress = newKeypair.toSuiAddress();
    
    return {
      success: true,
      wallet: {
        keypair: newKeypair,
        address: newAddress
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Cost Calculation
export const calculateStorageCost = async (file, epochs, walrusClient = null) => {
  try {
    let walAmount;
    
    if (walrusClient) {
      // Use WalrusClient if available
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Uint8Array(arrayBuffer);
      const { storageCost, writeCost } = await walrusClient.storageCost(blob.length, epochs);
      walAmount = Number(storageCost + writeCost);
      console.log(`💰 Calculated cost using WalrusClient: ${walAmount} MIST`);
    } else {
      console.log('⚠️  WalrusClient not available, using fallback cost calculation');
      console.log('💡 This may not reflect actual costs on Walrus network');
      // Fallback calculation (approximate)
      const basePrice = 1000000; // 1 MIST base price
      const sizeMultiplier = Math.ceil(file.size / 1024); // per KB
      const epochMultiplier = epochs;
      walAmount = basePrice * sizeMultiplier * epochMultiplier;
    }
    
    return {
      success: true,
      amount: walAmount,
      amountInSui: walAmount / 1000000000
    };
  } catch (error) {
    // Fallback calculation on error
    const fallbackAmount = 10000000; // 0.01 SUI
    return {
      success: true,
      amount: fallbackAmount,
      amountInSui: fallbackAmount / 1000000000,
      fallback: true,
      error: error.message
    };
  }
};

// Balance Checking
export const checkWalletBalance = async (address, suiClient) => {
  try {
    const balance = await suiClient.getBalance({
      owner: address,
    });
    
    return {
      success: true,
      balance: balance.totalBalance
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Payment Transaction Creation
export const createPaymentTransaction = (generatedWalletAddress, requiredAmount) => {
  try {
    const tx = new Transaction();
    
    // Transfer SUI to the generated wallet
    const [coin] = tx.splitCoins(tx.gas, [requiredAmount]);
    tx.transferObjects([coin], generatedWalletAddress);
    
    return {
      success: true,
      transaction: tx
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Walrus Client Initialization
export const initializeWalrusClient = (suiClient) => {
  try {
    const client = new WalrusClient({
      network: 'testnet',
      suiClient,
    });
    return {
      success: true,
      client
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// File Publishing to Walrus
export const publishToWalrus = async (file, wallet, epochs, walrusClient = null) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Uint8Array(arrayBuffer);
    
    if (walrusClient) {
      // Use WalrusClient
      const { blobObject } = await walrusClient.writeBlob({
        blob,
        deletable: true,
        epochs,
        signer: wallet.keypair,
        owner: wallet.address,
      });
      
      return {
        success: true,
        blobId: blobObject.storage.blob_id,
        storageId: blobObject.storage.id.id,
        objectId: blobObject.id.id,
        real: true
      };
    } else {
      // Fallback: simulate upload
      const fakeBlobId = 'blob_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      
      return {
        success: true,
        blobId: fakeBlobId,
        real: false
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Document Management
export const createDocumentInfo = (file, wallet, epochs, cost, blobInfo) => {
  return {
    id: blobInfo.objectId || 'doc_' + Date.now(),
    name: file.name,
    size: file.size,
    type: file.type,
    uploadDate: new Date().toISOString(),
    epochs,
    cost,
    blobId: blobInfo.blobId,
    storageId: blobInfo.storageId || null,
    walletAddress: wallet.address,
    real: blobInfo.real
  };
};

export const saveDocumentsToStorage = (documents) => {
  try {
    localStorage.setItem('walrus-documents', JSON.stringify(documents));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loadDocumentsFromStorage = () => {
  try {
    const stored = localStorage.getItem('walrus-documents');
    return {
      success: true,
      documents: stored ? JSON.parse(stored) : []
    };
  } catch (error) {
    return {
      success: false,
      documents: [],
      error: error.message
    };
  }
};

// Document Sharing and Download
export const getDocumentShareUrl = (blobId) => {
  return `${WALRUS_TESTNET_URL}/${blobId}`;
};

export const downloadDocument = async (doc) => {
  try {
    const url = getDocumentShareUrl(doc.blobId);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to download document');
    }
    
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Step Management Helper
export const createStepMessage = (message, type = 'info') => {
  return {
    id: Date.now(),
    message,
    type,
    timestamp: new Date().toLocaleTimeString()
  };
};

// Polling Helper
export const createBalancePoller = (walletAddress, requiredAmount, suiClient, onUpdate, onSuccess) => {
  const checkBalance = async () => {
    const result = await checkWalletBalance(walletAddress, suiClient);
    
    if (result.success) {
      const currentBalance = BigInt(result.balance);
      const required = BigInt(requiredAmount);
      
      onUpdate(result.balance, requiredAmount);
      
      if (currentBalance >= required) {
        onSuccess(result.balance);
        return true;
      }
    } else {
      console.error('Error checking balance:', result.error);
    }
    
    return false;
  };

  // Check every 3 seconds
  const pollInterval = setInterval(async () => {
    const funded = await checkBalance();
    if (funded) {
      clearInterval(pollInterval);
    }
  }, 3000);
  
  // Initial check
  checkBalance();
  
  // Return cleanup function
  return () => clearInterval(pollInterval);
};