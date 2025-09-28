import { useEffect, useState } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { parseStructTag } from '@mysten/sui/utils';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import Thickbox from './components/Thickbox';
import {
  formatFileSize,
  validateFile,
  calculateStorageCost,
  initializeWalrusClient,
  publishToWalrus,
  createDocumentInfo,
  saveDocumentsToStorage,
  loadDocumentsFromStorage,
  getDocumentShareUrl,
  createStepMessage,
} from './utils/walrusUtils';
import { createAddDocumentTransaction } from './utils/uploadToSmartcontract';

const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
const STORAGE_EPOCHS = 1;
const SUI_COIN_TYPE = '0x2::sui::SUI';
const GAS_BUDGET = 5_000_000;
const SUI_WRITE_GAS_BUFFER = 24_000_000n;
const MIN_GAS_RESERVE = 2_000_000n;

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
  const [isThickboxChecked, setIsThickboxChecked] = useState(false);
  const [uploadState, setUploadState] = useState({
    steps: [],
    currentStep: 'idle',
    error: null,
    sessionData: null,
  });

  // Helper function to get domain from zkLogin session storage
  const getDomainFromStorage = () => {
    try {
      const accountDataKey = 'zklogin-demo.accounts';
      const dataRaw = sessionStorage.getItem(accountDataKey);
      if (dataRaw) {
        const data = JSON.parse(dataRaw);
        if (data && data.length > 0 && data[0].domain) {
          return data[0].domain;
        }
      }
      return '';
    } catch (error) {
      console.warn('Error reading domain from session storage:', error);
      return '';
    }
  };

  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Helper function to get zkLogin ephemeral keypair from session storage
  const getZkLoginKeypair = () => {
    try {
      // First try to get from zklogin-demo.accounts (current format)
      const accountDataKey = 'zklogin-demo.accounts';
      const accountDataRaw = sessionStorage.getItem(accountDataKey);
      
      if (accountDataRaw) {
        const accountData = JSON.parse(accountDataRaw);
        if (accountData && accountData.length > 0 && accountData[0].ephemeralPrivateKey) {
          const ephemeralPrivateKey = accountData[0].ephemeralPrivateKey;
          
          // Decode the private key and create keypair
          const keyPair = decodeSuiPrivateKey(ephemeralPrivateKey);
          const zkKeypair = Ed25519Keypair.fromSecretKey(keyPair.secretKey);
          
          return {
            success: true,
            wallet: {
              keypair: zkKeypair,
              address: zkKeypair.toSuiAddress()
            }
          };
        }
      }
      
      // Fallback: try the old zklogin-demo.setup format
      const setupData = sessionStorage.getItem('zklogin-demo.setup');
      if (setupData) {
        const { ephemeralPrivateKey } = JSON.parse(setupData);
        if (ephemeralPrivateKey) {
          // Decode the private key and create keypair
          const keyPair = decodeSuiPrivateKey(ephemeralPrivateKey);
          const zkKeypair = Ed25519Keypair.fromSecretKey(keyPair.secretKey);
          
          return {
            success: true,
            wallet: {
              keypair: zkKeypair,
              address: zkKeypair.toSuiAddress()
            }
          };
        }
      }
      
      throw new Error('zkLogin session data not found. Please authenticate with zkLogin first.');
    } catch (error) {
      console.error('Failed to get zkLogin keypair:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  useEffect(() => {
    const loaded = loadDocumentsFromStorage();
    if (loaded.success) {
      setDocuments(loaded.documents);
    }
  }, []);

  const resetForm = () => {
    setDescription('');
    setFile(null);
    setFileInputKey((key) => key + 1);
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    const validation = validateFile(selectedFile);
    if (!validation.valid) {
      setUploadState((prev) => ({ ...prev, error: validation.error }));
      return;
    }

    setFile(selectedFile);
    setUploadState({ steps: [], currentStep: 'idle', error: null, sessionData: null });
  };

  const prepareUpload = async () => {
    if (!file || !account) {
      setUploadState((prev) => ({ ...prev, error: 'Please connect your wallet and select a file.' }));
      return;
    }

    if (!description.trim()) {
      setUploadState((prev) => ({ ...prev, error: 'Please add a short description before publishing.' }));
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
      setUploadState((prev) => ({ ...prev, currentStep: 'error', error: 'Failed to initialize Walrus client.' }));
      return;
    }

    const walrusClient = walrusClientResult.client;
    const costResult = await calculateStorageCost(file, STORAGE_EPOCHS, walrusClient);
    if (!costResult.success) {
      setUploadState((prev) => ({ ...prev, currentStep: 'error', error: 'Failed to calculate storage cost.' }));
      return;
    }

    // Use zkLogin ephemeral keypair instead of generating a new wallet
    const zkWalletResult = getZkLoginKeypair();
    if (!zkWalletResult.success) {
      setUploadState((prev) => ({ ...prev, currentStep: 'error', error: zkWalletResult.error }));
      return;
    }

    const zkWallet = zkWalletResult.wallet;

    const tx = new Transaction();
    let requiresExchange = false;
    const requiredWalAmount = costResult.amount;

    try {
      const balances = await suiClient.getAllBalances({ owner: account.address });
      
      const walBalance = balances.find((balance) => balance.coinType === TESTNET_WALRUS_PACKAGE_CONFIG.WAL_COIN_TYPE);
      const walAmount = walBalance ? BigInt(walBalance.totalBalance) : 0n;

      const suiCoins = await suiClient.getCoins({ owner: account.address, coinType: SUI_COIN_TYPE });
      if (!suiCoins.data || suiCoins.data.length === 0) {
        throw new Error('No SUI coins found to fund WAL exchange. Top up your wallet and try again.');
      }

      const [primarySuiCoin] = [...suiCoins.data].sort((a, b) => {
        const balanceA = BigInt(a.balance);
        const balanceB = BigInt(b.balance);
        if (balanceB > balanceA) return 1;
        if (balanceB < balanceA) return -1;
        return 0;
      });

      const primarySuiBalance = BigInt(primarySuiCoin.balance);
      const totalSuiForTransfers = requiredWalAmount + SUI_WRITE_GAS_BUFFER;
      const totalSuiNeeded = totalSuiForTransfers + BigInt(GAS_BUDGET) + MIN_GAS_RESERVE;

      if (primarySuiBalance <= totalSuiNeeded) {
        const neededInSui = totalSuiNeeded / 1_000_000_000n; // BigInt division
        const neededDisplay = Number(neededInSui).toFixed(4);
        throw new Error(`Not enough SUI to cover WAL funding. Ensure your largest SUI coin holds at least ${neededDisplay} SUI.`);
      }

      if (walAmount < requiredWalAmount) {
        requiresExchange = true;
        setUploadState((prev) => ({
          ...prev,
          steps: [...prev.steps, createStepMessage('Insufficient WAL balance detected. Preparing SUI → WAL exchange...')],
        }));

        const [suiToExchange] = tx.splitCoins(
          tx.gas,
          [tx.pure('u64', requiredWalAmount.toString())],
        );

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
          arguments: [tx.object(exchangeId), suiToExchange],
        });

        tx.transferObjects([walCoin], tx.pure('address', zkWallet.address));
        const [suiGas] = tx.splitCoins(
          tx.gas,
          [tx.pure('u64', SUI_WRITE_GAS_BUFFER.toString())],
        );
        tx.transferObjects([suiGas], tx.pure('address', zkWallet.address));
      } else {
        setUploadState((prev) => ({
          ...prev,
          steps: [...prev.steps, createStepMessage(`Sufficient WAL balance found. Preparing direct WAL transfer of ${requiredWalAmount.toString()} WAL.`)],
        }));

        const [suiGas] = tx.splitCoins(
          tx.gas,
          [tx.pure('u64', SUI_WRITE_GAS_BUFFER.toString())],
        );
        
        const walCoins = await suiClient.getCoins({
          owner: account.address,
          coinType: TESTNET_WALRUS_PACKAGE_CONFIG.WAL_COIN_TYPE,
        });

        if (!walCoins.data || !walCoins.data.length) {
          throw new Error('No WAL coins found in wallet, but balance check succeeded.');
        }

        const sortedWalCoins = [...walCoins.data].sort((a, b) => {
          const balanceA = BigInt(a.balance);
          const balanceB = BigInt(b.balance);
          if (balanceB > balanceA) return 1;
          if (balanceB < balanceA) return -1;
          return 0;
        });
        
        const totalWalBalance = sortedWalCoins.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
        
        if (totalWalBalance < requiredWalAmount) {
          throw new Error('Total WAL balance is below the storage requirement. Top up WAL and try again.');
        }

        const primaryWalCoinId = sortedWalCoins[0].coinObjectId;

        if (sortedWalCoins.length > 1) {
          setUploadState((prev) => ({
            ...prev,
            steps: [...prev.steps, createStepMessage('Merging WAL coins to cover storage cost...')],
          }));

          const otherWalCoins = sortedWalCoins.slice(1).map((coin) => tx.object(coin.coinObjectId));
          tx.mergeCoins(tx.object(primaryWalCoinId), otherWalCoins);
        }

        const [requiredWalCoin] = tx.splitCoins(
          tx.object(primaryWalCoinId),
          [tx.pure('u64', requiredWalAmount.toString())],
        );
        tx.transferObjects([requiredWalCoin, suiGas], tx.pure('address', zkWallet.address));
      }
    } catch (error) {
      setUploadState((prev) => ({
        ...prev,
        currentStep: 'error',
        error: `Failed to prepare transaction: ${error.message}`,
      }));
      return;
    }

    tx.setGasBudget(GAS_BUDGET);

    setUploadState((prev) => ({
      ...prev,
      currentStep: 'ready_to_fund',
      steps: [
        ...prev.steps,
        createStepMessage(`Using zkLogin ephemeral wallet: ${zkWallet.address.slice(0, 8)}...`),
        createStepMessage(`Storage cost calculated: ${costResult.amountInSui.toFixed(6)} SUI (WAL equivalent)`),
        createStepMessage('Transaction prepared. Ready for your approval.'),
      ],
      sessionData: {
        zkLoginWallet: zkWallet,
        walrusClient,
        costResult,
        fundingTransaction: tx,
        requiresExchange,
      },
    }));
  };

  const handleFundAndPublish = async () => {
    if (!uploadState.sessionData) return;

    const {
      zkLoginWallet,
      walrusClient,
      costResult,
      fundingTransaction,
      requiresExchange,
    } = uploadState.sessionData;

    try {
      setUploadState((prev) => ({
        ...prev,
        currentStep: 'signing',
        steps: [
          ...prev.steps,
          createStepMessage(`Please approve the ${requiresExchange ? 'exchange and transfer' : 'transfer'} transaction in your wallet...`),
        ],
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

      const tempWalletBalances = await suiClient.getAllBalances({ owner: zkLoginWallet.address });
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
        const retryBalances = await suiClient.getAllBalances({ owner: zkLoginWallet.address });
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

      const publishResult = await publishToWalrus(file, zkLoginWallet, STORAGE_EPOCHS, walrusClient);

      const newDoc = createDocumentInfo(file, zkLoginWallet, STORAGE_EPOCHS, costResult, publishResult, description);
      const updatedDocuments = [...documents, newDoc];
      setDocuments(updatedDocuments);
      saveDocumentsToStorage(updatedDocuments);

      // Now publish to smart contract
      const linkToBlobId = publishResult.blobId ? `https://walrus-testnet.blockscope.net/v1/blobs/${publishResult.blobId}` : '';
      
      // Create title with domain prefix if thickbox is checked
      let title = file.name;
      if (isThickboxChecked) {
        const domain = getDomainFromStorage();
        if (domain) {
          title = `[${domain}]${file.name}`;
        }
      }
      
      if (linkToBlobId) {
        setUploadState((prev) => ({
          ...prev,
          steps: [...prev.steps, createStepMessage('Publishing document information to smart contract...')],
        }));

        try {
          const smartContractTx = createAddDocumentTransaction(title, description, linkToBlobId);
          
          // Set the sender and build the transaction
          smartContractTx.setSender(zkLoginWallet.keypair.toSuiAddress());
          const txBytes = await smartContractTx.build({ client: suiClient });
          
          // Sign the transaction
          const { signature } = await zkLoginWallet.keypair.signTransaction(txBytes);
          
          // Execute the transaction
          const smartContractResult = await suiClient.executeTransactionBlock({
            transactionBlock: txBytes,
            signature: signature,
          });
          
          setUploadState((prev) => ({
            ...prev,
            steps: [...prev.steps, createStepMessage(`Document published to smart contract! Transaction: ${smartContractResult.digest}`)],
          }));
        } catch (smartContractError) {
          setUploadState((prev) => ({
            ...prev,
            steps: [...prev.steps, createStepMessage(`Warning: Failed to publish to smart contract: ${smartContractError.message}`)],
          }));
        }
      }

      setUploadState((prev) => ({
        ...prev,
        currentStep: 'completed',
        steps: [...prev.steps, createStepMessage(`File published successfully! Blob ID: ${publishResult.blobId}`)],
      }));
      resetForm();
    } catch (error) {
      setUploadState((prev) => ({
        ...prev,
        currentStep: 'error',
        error: `An error occurred: ${error.message}`,
      }));
    }
  };  const isButtonDisabled =
    !file ||
    !account ||
    !description.trim() ||
    ['preparing', 'signing', 'publishing'].includes(uploadState.currentStep);

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
          {uploadState.steps.map((step) => (
            <p key={step.id}>[{step.timestamp}] {step.message}</p>
          ))}
        </div>
      )}

      {/* Thickbox - moved from App.jsx and placed after Upload Status */}
      <Thickbox 
        isChecked={isThickboxChecked} 
        onCheckedChange={setIsThickboxChecked}
      />

      <div className="document-list">
        <h3>Uploaded Documents</h3>
        <p className="document-hint">These entries are saved locally for your browser session and aren’t yet part of the on-chain leak feed.</p>
        {documents.map((doc) => {
          const shareUrl = getDocumentShareUrl(doc.blobId, doc.suiBlobId);
          return (
            <div key={doc.id} className="document-item">
              <div className="document-content">
                <p><strong>Name:</strong> {doc.name}</p>
                <p><strong>Size:</strong> {formatFileSize(doc.size)}</p>
                {doc.description && <p><strong>Description:</strong> {doc.description}</p>}
                <p><strong>Blob ID:</strong> {doc.blobId}</p>
                {doc.recovered && (
                  <p className="document-recovered">Transaction failed on-chain; blob recovered from existing wallet state.</p>
                )}
                <a
                  href={shareUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!shareUrl}
                  className={!shareUrl ? 'disabled-link' : undefined}
                >
                  View on Walrus
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WalrusUploader;