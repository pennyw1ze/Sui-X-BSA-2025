import { useState, useEffect } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from "@mysten/sui/transactions";
import { parseStructTag } from '@mysten/sui/utils';
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
  suiToWalrusBlobId,
  createStepMessage,
} from './utils/walrusUtils';

// Sui Testnet client
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
const STORAGE_EPOCHS = 1;

export const TESTNET_WALRUS_PACKAGE_CONFIG = {
  systemObjectId: '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af',
  stakingPoolId: '0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3',
  exchangeIds: [
    '0xf4d164ea2def5fe07dc573992a029e010dba09b1a8dcbc44c5c2e79567f39073',
    '0x19825121c52080bb1073662231cfea5c0e4d905fd13e95f21e9a018f2ef41862',
    '0x83b454e524c71f30803f4d6c302a86fb6a39e96cdfb873c2d1e93bc1c26a3bc5',
    '0x8d63209cf8589ce7aef8f262437163c67577ed09f3e636a9d8e0813843fb8bf1',
  ],
  WAL_COIN_TYPE: '0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL',
};

const WalrusUploader = () => {
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [description, setDescription] = useState('');
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
        setUploadState((prev) => ({ ...prev, error: validation.error }));
      }
    }
  };

  // Step 1: Prepare the upload by calculating cost and creating a funding transaction
  const prepareUpload = async () => {
    if (!file || !account) {
      setUploadState(prev => ({ ...prev, error: 'Please connect your wallet and select a file.' }));
      return;
    }

    if (!description.trim()) {
      setUploadState(prev => ({ ...prev, error: 'Please add a short description before publishing.' }));
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

    const costResult = await calculateStorageCost(file, STORAGE_EPOCHS, walrusClient);
    if (!costResult.success) {
      setUploadState(prev => ({ ...prev, currentStep: 'error', error: 'Failed to calculate storage cost.' }));
      return;
    }

    const walletResult = generateNewWallet();
    if (!walletResult.success) {
      setUploadState(prev => ({ ...prev, currentStep: 'error', error: 'Failed to generate new wallet.' }));
      return;
    }

    const tx = new Transaction();
    let requiresExchange = false;
    const requiredWalAmount = costResult.amount;
    const SUI_WRITE_GAS_BUFFER = 10_000_000n;

    try {
      const balances = await suiClient.getAllBalances({ owner: account.address });
      const walBalance = balances.find((balance) => balance.coinType === TESTNET_WALRUS_PACKAGE_CONFIG.WAL_COIN_TYPE);
      const walAmount = walBalance ? BigInt(walBalance.totalBalance) : 0n;

      if (walAmount < requiredWalAmount) {
        requiresExchange = true;
        setUploadState((prev) => ({
          ...prev,
          steps: [...prev.steps, createStepMessage('Insufficient WAL balance detected. Preparing SUI → WAL exchange...')],
        }));

        const totalSuiToExchange = requiredWalAmount;
        const [suiToExchange] = tx.splitCoins(tx.gas, [tx.pure('u64', totalSuiToExchange.toString())]);

        const exchangeId = TESTNET_WALRUS_PACKAGE_CONFIG.exchangeIds[0];
        const exchangeObject = await suiClient.getObject({
          id: exchangeId,
          options: { showType: true },
        });

        if (!exchangeObject.data?.type) {
          throw new Error('Exchange object type not found.');
        }

        const exchangePackageId = parseStructTag(exchangeObject.data.type).address;
        const [walCoin] = tx.moveCall({
          package: exchangePackageId,
          module: 'wal_exchange',
          function: 'exchange_all_for_wal',
          arguments: [
            tx.object(exchangeId),
            suiToExchange,
          ],
        });

        tx.transferObjects([walCoin], tx.pure('address', walletResult.wallet.address));
        const [suiGas] = tx.splitCoins(tx.gas, [tx.pure('u64', SUI_WRITE_GAS_BUFFER.toString())]);
        tx.transferObjects([suiGas], tx.pure('address', walletResult.wallet.address));
      } else {
        setUploadState((prev) => ({
          ...prev,
          steps: [...prev.steps, createStepMessage(`Sufficient WAL balance found. Preparing direct WAL transfer of ${requiredWalAmount.toString()} WAL.`)],
        }));

        const [suiGas] = tx.splitCoins(tx.gas, [tx.pure('u64', SUI_WRITE_GAS_BUFFER.toString())]);
        const walCoins = await suiClient.getCoins({
          owner: account.address,
          coinType: TESTNET_WALRUS_PACKAGE_CONFIG.WAL_COIN_TYPE,
        });

        if (!walCoins.data || !walCoins.data.length) {
          throw new Error('No WAL coins found in wallet, but balance check succeeded.');
        }

        const primaryWalCoin = walCoins.data[0].coinObjectId;
        if (walCoins.data.length > 1) {
          const otherWalCoins = walCoins.data.slice(1).map((coin) => tx.object(coin.coinObjectId));
          tx.mergeCoins(tx.object(primaryWalCoin), otherWalCoins);
        }

        const [requiredWalCoin] = tx.splitCoins(
          tx.object(primaryWalCoin),
          [tx.pure('u64', requiredWalAmount.toString())]
        );

        tx.transferObjects([
          requiredWalCoin,
          suiGas,
        ], tx.pure('address', walletResult.wallet.address));
      }
    } catch (error) {
      setUploadState((prev) => ({
        ...prev,
        currentStep: 'error',
        error: `Failed to prepare transaction: ${error.message}`,
      }));
      return;
    }

    tx.setGasBudget(10_000_000);

    setUploadState(prev => ({
      ...prev,
      currentStep: 'ready_to_fund',
      steps: [
        ...prev.steps,
        createStepMessage(`Storage cost calculated: ${costResult.amountInSui.toFixed(6)} SUI (WAL equivalent)`),
        createStepMessage('Transaction prepared. Ready for your approval.'),
      ],
      sessionData: {
        generatedWallet: walletResult.wallet,
        walrusClient,
        costResult,
        fundingTransaction: tx,
        requiresExchange,
      }
    }));
  };

  // Step 2: User signs the funding transaction, then we publish the file
  const handleFundAndPublish = async () => {
    if (!uploadState.sessionData) return;

    const {
      generatedWallet,
      walrusClient,
      costResult,
      fundingTransaction,
      requiresExchange,
    } = uploadState.sessionData;

    try {
      setUploadState((prev) => ({
        ...prev,
        currentStep: 'signing',
        steps: [...prev.steps, createStepMessage(`Please approve the ${requiresExchange ? 'exchange and transfer' : 'transfer'} transaction in your wallet...`)],
      }));

      await signAndExecute({ transaction: fundingTransaction });

      setUploadState((prev) => ({
        ...prev,
        currentStep: 'publishing',
        steps: [...prev.steps, createStepMessage('Funding successful. Waiting for transaction confirmation...')],
      }));

      await new Promise((resolve) => setTimeout(resolve, 8000));

      setUploadState((prev) => ({
        ...prev,
        steps: [...prev.steps, createStepMessage('Checking temporary wallet balance...')],
      }));

      const tempWalletBalances = await suiClient.getAllBalances({ owner: generatedWallet.address });
      const walBalance = tempWalletBalances.find((balance) => balance.coinType === TESTNET_WALRUS_PACKAGE_CONFIG.WAL_COIN_TYPE);
      const suiBalance = tempWalletBalances.find((balance) => balance.coinType === '0x2::sui::SUI');

      setUploadState((prev) => ({
        ...prev,
        steps: [
          ...prev.steps,
          createStepMessage(`Temp wallet - WAL: ${walBalance ? walBalance.totalBalance : '0'}, SUI: ${suiBalance ? suiBalance.totalBalance : '0'}`),
        ],
      }));

      if (!walBalance || BigInt(walBalance.totalBalance) === 0n) {
        setUploadState((prev) => ({
          ...prev,
          steps: [...prev.steps, createStepMessage('WAL tokens not detected yet. Waiting 5 more seconds...')],
        }));

        await new Promise((resolve) => setTimeout(resolve, 5000));

        const retryBalances = await suiClient.getAllBalances({ owner: generatedWallet.address });
        const retryWalBalance = retryBalances.find((balance) => balance.coinType === TESTNET_WALRUS_PACKAGE_CONFIG.WAL_COIN_TYPE);

        if (!retryWalBalance || BigInt(retryWalBalance.totalBalance) === 0n) {
          throw new Error('Temporary wallet did not receive WAL tokens after waiting.');
        }

        setUploadState((prev) => ({
          ...prev,
          steps: [...prev.steps, createStepMessage(`Retry successful - WAL: ${retryWalBalance.totalBalance}`)],
        }));
      }

      setUploadState((prev) => ({
        ...prev,
        steps: [...prev.steps, createStepMessage('Publishing file to Walrus...')],
      }));

  const publishResult = await publishToWalrus(file, generatedWallet, STORAGE_EPOCHS, walrusClient);

      if (!publishResult.success) {
        const blobs = await suiClient.getOwnedObjects({
          owner: generatedWallet.address,
          filter: {
            StructType: '0xd84704c17fc870b8764832c535aa6b11f21a95cd6f5bb38a9b07d2cf42220c66::blob::Blob',
          },
          options: { showType: true, showContent: true },
        });

        if (blobs.data && blobs.data.length > 0) {
          const lastBlob = blobs.data[blobs.data.length - 1];
          const blobId = lastBlob?.data?.content?.fields?.blob_id
            ? suiToWalrusBlobId(lastBlob.data.content.fields.blob_id)
            : null;

          if (!blobId) {
            throw new Error('Failed to recover blob ID from Walrus response.');
          }

          const recoveredDoc = createDocumentInfo(file, generatedWallet, STORAGE_EPOCHS, costResult, {
            success: true,
            blobId,
            storageId: null,
            objectId: lastBlob?.data?.content?.fields?.id?.id ?? null,
            suiBlobId: lastBlob?.data?.content?.fields?.blob_id,
            real: true,
          }, description);

          const updatedDocuments = [...documents, recoveredDoc];
          setDocuments(updatedDocuments);
          saveDocumentsToStorage(updatedDocuments);

          setUploadState((prev) => ({
            ...prev,
            currentStep: 'completed',
            steps: [...prev.steps, createStepMessage(`File published (recovered)! Blob ID: ${blobId}`)],
          }));
          setDescription('');
          setFile(null);
          setFileInputKey((key) => key + 1);
          return;
        }

        throw new Error(publishResult.error || 'Failed to publish and no blob found in temporary wallet.');
      }
      const newDoc = createDocumentInfo(file, generatedWallet, STORAGE_EPOCHS, costResult, publishResult, description);
      const updatedDocuments = [...documents, newDoc];
      setDocuments(updatedDocuments);
      saveDocumentsToStorage(updatedDocuments);

      setUploadState((prev) => ({
        ...prev,
        currentStep: 'completed',
        steps: [...prev.steps, createStepMessage(`File published successfully! Blob ID: ${publishResult.blobId}`)],
      }));
      setDescription('');
      setFile(null);
      setFileInputKey((key) => key + 1);
    } catch (error) {
      setUploadState((prev) => ({
        ...prev,
        currentStep: 'error',
        error: `An error occurred: ${error.message}`,
      }));
    }
  };

  const isButtonDisabled = !file || !account || !description.trim() || ['preparing', 'signing', 'publishing'].includes(uploadState.currentStep);

  return (
    <div className="walrus-uploader">
      <div className="upload-box">
        <input key={fileInputKey} type="file" onChange={handleFileChange} />
        {file && <p>Selected file: {file.name} ({formatFileSize(file.size)})</p>}
        <label className="description-label">
          Brief Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Share context for this document (required)"
            rows={3}
          />
        </label>
        <p className="storage-note">Files are currently pinned for a single Walrus epoch; renewal logic will land soon.</p>

        {uploadState.currentStep !== 'ready_to_fund' ? (
            <button onClick={prepareUpload} disabled={isButtonDisabled}>
              Prepare Upload
            </button>
        ) : (
            <button onClick={handleFundAndPublish} disabled={isButtonDisabled}>
              {uploadState.sessionData?.requiresExchange ? 'Approve SUI → WAL Swap & Publish' : 'Approve Transfer & Publish'}
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
        <p className="document-hint">These entries are saved locally for your browser session and aren&rsquo;t yet part of the on-chain leak feed.</p>
        {documents.map(doc => {
            const shareUrl = getDocumentShareUrl(doc.blobId, doc.suiBlobId);
            return (
              <div key={doc.id} className="document-item">
                  <p><strong>Name:</strong> {doc.name}</p>
                  <p><strong>Size:</strong> {formatFileSize(doc.size)}</p>
                  {doc.description && <p><strong>Description:</strong> {doc.description}</p>}
                  <p><strong>Blob ID:</strong> {doc.blobId}</p>
                  <a
                    href={shareUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!shareUrl}
                    className={!shareUrl ? 'disabled-link' : undefined}
                  >
                    View on Walrus
                  </a>
                  <button onClick={() => downloadDocument(doc)}>Download</button>
              </div>
            );
        })}
      </div>
    </div>
  );
};

export default WalrusUploader;