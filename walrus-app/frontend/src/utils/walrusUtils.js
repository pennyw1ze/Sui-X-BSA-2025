// src/utils/walrusUtils.js

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { WalrusClient } from '@mysten/walrus'; // This is the only import needed from @mysten/walrus

// Constants
export const ALLOWED_FILE_TYPES = [
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/markdown', 'image/jpeg', 'image/png', 'image/gif'
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
    return { valid: false, error: 'Please select a valid file (PDF, DOC, DOCX, TXT, MD, JPG, PNG, GIF)' };
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
    return { success: true, wallet: { keypair: newKeypair, address: newAddress } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Cost Calculation
export const calculateStorageCost = async (file, epochs, walrusClient) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Uint8Array(arrayBuffer);
    const { storageCost, writeCost } = await walrusClient.storageCost(blob.length, epochs);
    const walAmount = Number(storageCost) + Number(writeCost);
    return { success: true, amount: walAmount, amountInSui: walAmount / 1_000_000_000 };
  } catch (error) {
    return { success: false, error: `Cost calculation failed: ${error.message}` };
  }
};

// Walrus Client Initialization
export const initializeWalrusClient = (suiClient) => {
  try {
    const client = new WalrusClient({ network: 'testnet', suiClient });
    return { success: true, client };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// File Publishing to Walrus
export const publishToWalrus = async (file, wallet, epochs, walrusClient) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Uint8Array(arrayBuffer);
    
    if (walrusClient) {
      const { blobObject } = await walrusClient.writeBlob({
        blob,
        deletable: true, // Set a value for deletable
        epochs,
        signer: wallet.keypair, // Use the keypair from the passed wallet object
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
      throw new Error("Walrus client is not initialized.");
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Document Management
export const createDocumentInfo = (file, wallet, epochs, cost, blobInfo) => {
  return {
    id: blobInfo.objectId || 'doc_' + Date.now(),
    name: file.name, size: file.size, type: file.type,
    uploadDate: new Date().toISOString(), epochs, cost,
    blobId: blobInfo.blobId, storageId: blobInfo.storageId || null,
    walletAddress: wallet.address, real: blobInfo.real
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
    return { success: true, documents: stored ? JSON.parse(stored) : [] };
  } catch (error) {
    return { success: false, documents: [], error: error.message };
  }
};

// Document Sharing and Download
export const getDocumentShareUrl = (blobId) => `${WALRUS_TESTNET_URL}/${blobId}`;

export const downloadDocument = async (doc) => {
  try {
    const url = getDocumentShareUrl(doc.blobId);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to download document');
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(downloadUrl);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Step Management Helper
export const createStepMessage = (message) => ({
  id: Date.now(), message, timestamp: new Date().toLocaleTimeString()
});