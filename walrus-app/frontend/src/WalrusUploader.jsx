import { useState, useEffect } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  formatFileSize,
  validateFile,
  generateNewWallet,
  calculateStorageCost,
  checkWalletBalance,
  createPaymentTransaction,
  initializeWalrusClient,
  publishToWalrus,
  createDocumentInfo,
  saveDocumentsToStorage,
  loadDocumentsFromStorage,
  getDocumentShareUrl,
  downloadDocument,
  copyToClipboard,
  createStepMessage,
  createBalancePoller,
} from './utils/walrusUtils';

// Sui Testnet client
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

const WalrusUploader = () => {
  const [file, setFile] = useState(null);
  const [epochs, setEpochs] = useState(1);
  const [documents, setDocuments] = useState([]);
  const [uploadState, setUploadState] = useState({
    steps: [],
    currentStep: 'idle',
    generatedWallet: null,
    requiredAmount: 0,
    error: null,
  });

  useEffect(() => {
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
        setUploadState({ ...uploadState, error: null });
      } else {
        setUploadState({ ...uploadState, error: validation.error });
      }
    }
  };

  const startUploadProcess = async () => {
    if (!file) return;

    setUploadState({
      steps: [createStepMessage('Starting upload process...')],
      currentStep: 'processing',
      generatedWallet: null,
      requiredAmount: 0,
      error: null,
    });

    // 1. Initialize Walrus Client
    const walrusClientResult = initializeWalrusClient(suiClient);
    if (!walrusClientResult.success) {
        setUploadState(prev => ({ ...prev, error: 'Failed to initialize Walrus client.' }));
        return;
    }
    const walrusClient = walrusClientResult.client;
    
    // 2. Calculate storage cost
    const costResult = await calculateStorageCost(file, epochs, walrusClient);
    if (!costResult.success) {
        setUploadState(prev => ({ ...prev, error: 'Failed to calculate storage cost.' }));
        return;
    }
    setUploadState(prev => ({
        ...prev,
        requiredAmount: costResult.amount,
        steps: [...prev.steps, createStepMessage(`Storage cost calculated: ${costResult.amountInSui.toFixed(6)} SUI`)]
    }));

    // 3. Generate new SUI wallet
    const walletResult = generateNewWallet();
    if (!walletResult.success) {
        setUploadState(prev => ({ ...prev, error: 'Failed to generate new wallet.' }));
        return;
    }
    setUploadState(prev => ({
        ...prev,
        generatedWallet: walletResult.wallet,
        steps: [...prev.steps, createStepMessage(`Generated new wallet: ${walletResult.wallet.address}`)]
    }));

    // 4. Wait for funds
    setUploadState(prev => ({
        ...prev,
        currentStep: 'waiting_for_funds',
        steps: [...prev.steps, createStepMessage('Waiting for SUI deposit...')],
    }));

    const poller = createBalancePoller(
        walletResult.wallet.address,
        costResult.amount,
        suiClient,
        (balance, required) => {
            const progress = (Number(balance) / Number(required) * 100).toFixed(2);
            const message = `Balance update: ${balance} / ${required} MIST (${progress}%)`;
            setUploadState(prev => ({
                ...prev,
                steps: [...prev.steps.slice(0, prev.steps.length -1), createStepMessage(message)],
            }));
        },
        async () => {
            poller(); // Stop polling
            setUploadState(prev => ({
                ...prev,
                currentStep: 'publishing',
                steps: [...prev.steps, createStepMessage('Sufficient balance received. Publishing to Walrus...')],
            }));
            
            // 5. Publish to Walrus
            const publishResult = await publishToWalrus(file, walletResult.wallet, epochs, walrusClient);
            if (publishResult.success) {
                const newDoc = createDocumentInfo(file, walletResult.wallet, epochs, costResult, publishResult);
                const updatedDocuments = [...documents, newDoc];
                setDocuments(updatedDocuments);
                saveDocumentsToStorage(updatedDocuments);
                setUploadState(prev => ({
                    ...prev,
                    currentStep: 'completed',
                    steps: [...prev.steps, createStepMessage(`File published! Blob ID: ${publishResult.blobId}`)],
                }));
            } else {
                setUploadState(prev => ({
                    ...prev,
                    currentStep: 'error',
                    error: 'Failed to publish file: ' + publishResult.error,
                }));
            }
        }
    );
  };

  return (
    <div className="walrus-uploader">
      <div className="upload-box">
        <input type="file" onChange={handleFileChange} />
        {file && <p>Selected file: {file.name} ({formatFileSize(file.size)})</p>}
        
        <div className="epochs-selector">
            <label>Storage Epochs:</label>
            <input type="number" value={epochs} onChange={e => setEpochs(Number(e.target.value))} min="1" />
        </div>

        <button onClick={startUploadProcess} disabled={!file || uploadState.currentStep === 'processing'}>
          Upload File
        </button>
        {uploadState.error && <p className="error">{uploadState.error}</p>}
      </div>

      {uploadState.currentStep !== 'idle' && (
        <div className="status-box">
          <h3>Upload Status</h3>
          {uploadState.steps.map(step => (
            <p key={step.id}>[{step.timestamp}] {step.message}</p>
          ))}
          {uploadState.currentStep === 'waiting_for_funds' && uploadState.generatedWallet && (
            <div className='funding-details'>
                <h4>Please send at least {uploadState.requiredAmount / 10**9} SUI to this address:</h4>
                <code>{uploadState.generatedWallet.address}</code>
                <button onClick={() => copyToClipboard(uploadState.generatedWallet.address)}>Copy</button>
            </div>
          )}
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