// src/utils/walrusUtils.js

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { WalrusClient } from '@mysten/walrus'; // This is the only import needed from @mysten/walrus
import { Buffer } from 'buffer';

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
  const toBigInt = (value) => {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(Math.trunc(value));
    if (typeof value === 'string') return BigInt(value);
    if (value && typeof value === 'object' && typeof value.toString === 'function') {
      return BigInt(value.toString());
    }
    return 0n;
  };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Uint8Array(arrayBuffer);
    const { storageCost, writeCost } = await walrusClient.storageCost(blob.length, epochs);
    const storageCostBig = toBigInt(storageCost);
    const writeCostBig = toBigInt(writeCost);
    const walAmount = storageCostBig + writeCostBig;
    return {
      success: true,
      amount: walAmount,
      amountInSui: Number(walAmount) / 1_000_000_000,
    };
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
    if (!walrusClient) {
      throw new Error('Walrus client is not initialized.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const blob = new Uint8Array(arrayBuffer);

    const response = await walrusClient.writeBlob({
      blob,
      deletable: false,
      epochs,
      signer: wallet.keypair,
      owner: wallet.address,
    });

    const blobObject = response?.blobObject ?? response;
    const rawBlobId = blobObject?.storage?.blob_id
      ?? blobObject?.storage?.blobId
      ?? blobObject?.id?.id
      ?? blobObject?.id
      ?? null;
    const convertedBlobId = rawBlobId ? suiToWalrusBlobId(rawBlobId) : null;

    return {
      success: true,
      blobId: convertedBlobId ?? (rawBlobId ? String(rawBlobId) : null),
      suiBlobId: rawBlobId ? String(rawBlobId) : null,
      storageId: blobObject?.storage?.id?.id ?? blobObject?.storage?.id ?? null,
      objectId: blobObject?.id?.id ?? blobObject?.id ?? null,
      real: true,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const suiToWalrusBlobId = (decimal) => {
  try {
    const bigIntValue = typeof decimal === 'bigint' ? decimal : BigInt(decimal);
    const hex = bigIntValue.toString(16).padStart(64, '0');
    const reversedHex = hex.match(/.{2}/g).reverse().join('');
    const buffer = Buffer.from(reversedHex, 'hex');
    const base64 = buffer.toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    console.error('Error converting Sui blob ID to Walrus format:', error);
    return null;
  }
};

export const suiToWalrusBlobIdAlt = (decimal) => {
  try {
    const bigIntValue = typeof decimal === 'bigint' ? decimal : BigInt(decimal);
    const hex = bigIntValue.toString(16).padStart(64, '0');
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    console.error('Error in alternative conversion:', error);
    return null;
  }
};

export const walrusToSuiBlobId = (walrusBlobId) => {
  try {
    let base64 = walrusBlobId.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const buffer = Buffer.from(base64, 'base64');
    const hex = buffer.toString('hex');
    const reversedHex = hex.match(/.{2}/g).reverse().join('');
    return BigInt(`0x${reversedHex}`).toString();
  } catch (error) {
    console.error('Error converting Walrus blob ID back to Sui format:', error);
    return null;
  }
};

// Document Management
export const createDocumentInfo = (file, wallet, epochs, cost, blobInfo, description = '') => {
  const normalizedCost = cost
    ? {
        ...cost,
        amount: typeof cost.amount === 'bigint' ? cost.amount.toString() : cost.amount,
      }
    : null;

  return {
    id: blobInfo.objectId || 'doc_' + Date.now(),
    name: file.name, size: file.size, type: file.type,
    uploadDate: new Date().toISOString(), epochs, cost: normalizedCost,
    blobId: blobInfo.blobId, suiBlobId: blobInfo.suiBlobId || null,
    storageId: blobInfo.storageId || null,
    walletAddress: wallet.address, real: blobInfo.real,
    description,
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
export const getDocumentShareUrl = (blobId, fallbackSuiBlobId = null) => {
  const resolvedId = blobId || (fallbackSuiBlobId ? suiToWalrusBlobId(fallbackSuiBlobId) : null);
  if (!resolvedId) return null;
  return `${WALRUS_TESTNET_URL}/${resolvedId}`;
};

export const downloadDocument = async (doc) => {
  try {
    const blobId = doc.blobId || (doc.suiBlobId ? suiToWalrusBlobId(doc.suiBlobId) : null);
    if (!blobId) {
      throw new Error('Missing Walrus blob identifier');
    }
    const url = getDocumentShareUrl(blobId);
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
  id: Date.now() + Math.random(),
  message,
  timestamp: new Date().toLocaleTimeString()
});