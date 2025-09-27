import { useState, useEffect } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import {
  formatFileSize,
  validateFile,
  generateNewWallet,
  calculateStorageCost,
  initializeWalrusClient,
  publishToWalrus,
  createDocumentInfo,
  saveDocumentsToStorage,
  loadDocumentsFromStorage,
  getDocumentShareUrl,
  downloadDocument,
  createStepMessage,
} from './utils/walrusUtils';

// Sui Testnet client
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

const WalrusUploader = () => {
  const [file, setFile] = useState(null);
  const [epochs, setEpochs] = useState(1);
  const [documents, setDocuments] = useState([]);
  const [uploadState, setUploadState] = useState({
    steps: [],
    currentStep: 'idle', // idle, preparing, ready_to_fund, signing, publishing, completed, error
    error: null,
    sessionData: null, // To store temporary data like the new wallet and transaction
  });

  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  useEffect(() => {
    // Load previously uploaded documents from local storage on component mount
    const loaded = loadDocumentsFromStorage();
    if (loaded.success) {
      setDocuments(loaded.documents);
    }
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validation = validateFile(selectedFile);
      if (validation.valid) {
        setFile(selectedFile);
        // Reset state when a new file is selected
        setUploadState({ steps: [], currentStep: 'idle', error: null, sessionData: null });
      } else {
        setUploadState({ ...uploadState, error: validation.error });
      }
    }
  };

  // Step 1: Prepare the upload by calculating cost and creating a funding transaction
  const prepareUpload = async () => {
    if (!file || !account) {
      setUploadState(prev => ({ ...prev, error: 'Please connect your wallet and select a file.' }));
      return;
    }

    setUploadState({
      steps: [createStepMessage('Starting upload preparation...')],
      currentStep: 'preparing',
      error: null,
      sessionData: null,
    });

    const walrusClientResult = initializeWalrusClient(suiClient);
    if (!walrusClientResult.success) {
      setUploadState(prev => ({ ...prev, currentStep: 'error', error: 'Failed to initialize Walrus client.' }));
      return;
    }
    const walrusClient = walrusClientResult.client;
    
    const costResult = await calculateStorageCost(file, epochs, walrusClient);
    if (!costResult.success) {
      setUploadState(prev => ({ ...prev, currentStep: 'error', error: 'Failed to calculate storage cost.' }));
      return;
    }

    const walletResult = generateNewWallet();
    if (!walletResult.success) {
      setUploadState(prev => ({ ...prev, currentStep: 'error', error: 'Failed to generate new wallet.' }));
      return;
    }

    // Create a transaction to fund the temporary wallet from the user's connected wallet
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(costResult.amount)]);
    tx.transferObjects([coin], tx.pure(walletResult.wallet.address));

    setUploadState(prev => ({
      ...prev,
      currentStep: 'ready_to_fund',
      steps: [
        ...prev.steps,
        createStepMessage(`Storage cost calculated: ${costResult.amountInSui.toFixed(6)} SUI`),
        createStepMessage(`Transaction prepared. Ready for your approval.`)
      ],
      sessionData: {
        generatedWallet: walletResult.wallet,
        walrusClient,
        costResult,
        fundingTransaction: tx,
      }
    }));
  };

  // Step 2: User signs the funding transaction, then we publish the file
  const handleFundAndPublish = async () => {
    if (!uploadState.sessionData) return;

    const { generatedWallet, walrusClient, costResult, fundingTransaction } = uploadState.sessionData;

    try {
      setUploadState(prev => ({
        ...prev,
        currentStep: 'signing',
        steps: [...prev.steps, createStepMessage('Please approve the funding transaction in your wallet...')],
      }));

      // Use dApp Kit to sign and execute the funding transaction
      await signAndExecute({ transaction: fundingTransaction });

      setUploadState(prev => ({
        ...prev,
        currentStep: 'publishing',
        steps: [...prev.steps, createStepMessage('Funding successful! Publishing file to Walrus...')],
      }));

      // Now that the temporary wallet is funded, publish the file
      const publishResult = await publishToWalrus(file, generatedWallet, epochs, walrusClient);
      
      if (publishResult.success) {
        const newDoc = createDocumentInfo(file, generatedWallet, epochs, costResult, publishResult);
        const updatedDocuments = [...documents, newDoc];
        setDocuments(updatedDocuments);
        saveDocumentsToStorage(updatedDocuments);
        setUploadState(prev => ({
          ...prev,
          currentStep: 'completed',
          steps: [...prev.steps, createStepMessage(`File published successfully! Blob ID: ${publishResult.blobId}`)],
        }));
      } else {
        // This will catch errors from the Walrus SDK itself
        throw new Error(publishResult.error);
      }
    } catch (error) {
      // This will catch transaction signing errors or the error thrown above
      setUploadState(prev => ({
        ...prev,
        currentStep: 'error',
        error: `An error occurred: ${error.message}`,
      }));
    }
  };

  const isButtonDisabled = !file || !account || ['preparing', 'signing', 'publishing'].includes(uploadState.currentStep);

  return (
    <div className="walrus-uploader">
      <div className="upload-box">
        <input type="file" onChange={handleFileChange} />
        {file && <p>Selected file: {file.name} ({formatFileSize(file.size)})</p>}
        
        <div className="epochs-selector">
            <label>Storage Epochs:</label>
            <input type="number" value={epochs} onChange={e => setEpochs(Number(e.target.value))} min="1" />
        </div>

        {uploadState.currentStep !== 'ready_to_fund' ? (
            <button onClick={prepareUpload} disabled={isButtonDisabled}>
              Prepare Upload
            </button>
        ) : (
            <button onClick={handleFundAndPublish} disabled={isButtonDisabled}>
              Approve & Publish
            </button>
        )}

        {uploadState.error && <p className="error">{uploadState.error}</p>}
      </div>

      {uploadState.steps.length > 0 && (
        <div className="status-box">
          <h3>Upload Status</h3>
          {uploadState.steps.map(step => (
            <p key={step.id}>[{step.timestamp}] {step.message}</p>
          ))}
        </div>
      )}

      <div className="document-list">
        <h3>Uploaded Documents</h3>
        {documents.map(doc => (
            <div key={doc.id} className="document-item">
                <p><strong>Name:</strong> {doc.name}</p>
                <p><strong>Size:</strong> {formatFileSize(doc.size)}</p>
                <p><strong>Blob ID:</strong> {doc.blobId}</p>
                <a href={getDocumentShareUrl(doc.blobId)} target="_blank" rel="noopener noreferrer">View on Walrus</a>
                <button onClick={() => downloadDocument(doc)}>Download</button>
            </div>
        ))}
      </div>
    </div>
  );
};

export default WalrusUploader;