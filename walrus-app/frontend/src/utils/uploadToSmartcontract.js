// uploadToSmartcontract.js
import { Transaction } from '@mysten/sui/transactions';

// 🔧 CONFIG
const PACKAGE_ID = "0x15554aa6dea72b642981dd296e4325fc78f8b3cdb02f283837719c37320634d7"; // your package
const MODULE_NAME = "documents_list"; // replace with actual module name
const FUNCTION_NAME = "add_document";
const DOCUMENT_LIST_ID = "0xd7515be8943d0751fc7c11600b9cad477d97f061b081db614379e639f0f02e93"; // replace with actual DocumentsList object ID on chain

export function createAddDocumentTransaction(title, description, linkToBlobId) {
  // Build transaction block
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
    arguments: [
      tx.object(DOCUMENT_LIST_ID),    // mutable reference to DocumentsList object
      tx.pure.string(title),
      tx.pure.string(description),
      tx.pure.string(linkToBlobId),
    ],
  });

  return tx;
}