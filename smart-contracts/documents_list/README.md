# DocumentsList Smart Contract

A blockchain-like immutable document storage smart contract built on Sui blockchain for storing Walrus documents with rich metadata (title, description, and link).

# Object generation

Smart contract publishing:
```cli
sui client publish --gas-budget 100000000  
```
Obtained smart contract public ID:
```
0x15554aa6dea72b642981dd296e4325fc78f8b3cdb02f283837719c37320634d7 
```
The list is created instantly. Our ID is:
```cli
0xd7515be8943d0751fc7c11600b9cad477d97f061b081db614379e639f0f02e93
```


## 🎯 Overview

The `documents_list` smart contract provides a simple, append-only list for storing structured documents from the Walrus decentralized storage network. Each document contains a title, description, and link. It operates as a global singleton with blockchain-like properties: once data is added, it cannot be modified or deleted.

## 🏗️ Architecture

### Core Concepts
- **Singleton Pattern**: Only one global list exists per deployment
- **Immutable**: No deletion or modification allowed (append-only)
- **Public Access**: Anyone can add documents to the list
- **Shared Object**: Automatically accessible to all users after deployment
- **Rich Metadata**: Each document includes title, description, and Walrus link

### Data Structures

#### Document Structure
```move
public struct Document has store, copy, drop {
    title: String,        // Document title
    description: String,  // Document description
    link: String         // Walrus document URL
}
```

#### Documents List
```move
public struct DocumentsList has key {
    id: UID,
    items: vector<Document>  // Vector of Document structs
}
```

## 🚀 Functions

### Public Functions

#### `add_document(documents_list, title, description, link): bool`
- **Purpose**: Add a new document with metadata to the global list
- **Access**: Anyone can call this function
- **Parameters**: 
  - `documents_list`: Mutable reference to the shared list
  - `title`: String containing the document title
  - `description`: String containing the document description
  - `link`: String containing the Walrus document URL
- **Returns**: `true` for success
- **Example**: 
```move
add_document(
    &mut list,
    string::utf8(b"Research Paper"),
    string::utf8(b"A study on blockchain technology"),
    string::utf8(b"https://walrus.site/doc123")
)
```

#### `get_all_documents(documents_list): vector<Document>`
- **Purpose**: Retrieve all documents from the list
- **Access**: Anyone can call this function (read-only)
- **Parameters**: 
  - `documents_list`: Immutable reference to the shared list
- **Returns**: Vector of all stored Document structs
- **TypeScript Compatible**: Returns as `Document[]`

#### `get_document_count(documents_list): u64`
- **Purpose**: Get the total number of documents stored
- **Access**: Anyone can call this function (read-only)
- **Returns**: Number of documents in the list

### Document Helper Functions

#### `get_document_title(document): String`
- **Purpose**: Extract title from a Document struct
- **Returns**: Document title

#### `get_document_description(document): String`
- **Purpose**: Extract description from a Document struct
- **Returns**: Document description

#### `get_document_link(document): String`
- **Purpose**: Extract link from a Document struct
- **Returns**: Document Walrus URL

### Private Functions

#### `init(ctx: &mut TxContext)`
- **Purpose**: Initialize the global documents list during deployment
- **Access**: Automatically called once during contract deployment
- **Behavior**: Creates the shared DocumentsList object

## 📋 Usage Examples

### Move/Sui CLI

```move
// Add a document with metadata
public entry fun add_research_paper(documents_list: &mut DocumentsList) {
    documents_list::add_document(
        documents_list,
        string::utf8(b"Blockchain Research"),
        string::utf8(b"Comprehensive analysis of consensus mechanisms"),
        string::utf8(b"https://walrus.site/research-paper-hash")
    );
}

// Read all documents
public fun read_all_documents(documents_list: &DocumentsList): vector<Document> {
    documents_list::get_all_documents(documents_list)
}

// Access specific document fields
public fun get_first_document_info(documents_list: &DocumentsList): (String, String, String) {
    let docs = documents_list::get_all_documents(documents_list);
    if (vector::length(&docs) > 0) {
        let doc = vector::borrow(&docs, 0);
        (
            documents_list::get_document_title(doc),
            documents_list::get_document_description(doc),
            documents_list::get_document_link(doc)
        )
    } else {
        (string::utf8(b""), string::utf8(b""), string::utf8(b""))
    }
}
```

### TypeScript Integration

```typescript
import { TransactionBlock } from '@mysten/sui.js/transactions';

// Add a document with metadata
const txb = new TransactionBlock();
txb.moveCall({
    target: `${PACKAGE_ID}::documents_list::add_document`,
    arguments: [
        txb.object(DOCUMENTS_LIST_ID),
        txb.pure("Technical Guide"),
        txb.pure("How to integrate Walrus with Sui blockchain"),
        txb.pure("https://walrus.site/guide-hash")
    ]
});

const result = await suiClient.signAndExecuteTransactionBlock({
    transactionBlock: txb,
    signer: keypair
});

// Read all documents
const allDocs = await suiClient.devInspectTransactionBlock({
    transactionBlock: readTxb,
    sender: address
});

// Expected Document structure in TypeScript:
interface Document {
    title: string;
    description: string;
    link: string;
}

// Process returned documents
const documents: Document[] = allDocs.results[0].returnValues[0];
documents.forEach(doc => {
    console.log(`Title: ${doc.title}`);
    console.log(`Description: ${doc.description}`);
    console.log(`Link: ${doc.link}`);
});
```

## 🧪 Testing

Run the test suite:
```bash
sui move test
```

The test covers:
- Creating the shared documents list
- Adding structured documents from multiple users
- Reading documents with metadata from any user
- Verifying document count and structure

## 🏗️ Building & Deployment

### Build
```bash
sui move build
```

### Test
```bash
sui move test
```

### Deploy
```bash
sui client publish --gas-budget 20000000
```

After deployment:
1. The `init()` function runs automatically
2. A shared `DocumentsList` object is created
3. Anyone can interact with this global list to add/read documents

## 🔒 Security Features

- **Immutable Data**: Once added, documents cannot be removed or modified
- **Public Accessibility**: No ownership restrictions on reading or adding
- **Transparent**: All operations are recorded on the blockchain
- **No Admin Functions**: No special privileges or backdoors
- **Structured Data**: Enforced document schema with title, description, and link

## 🌐 Integration with Walrus

This smart contract is designed to work with [Walrus](https://walrus.site/) decentralized storage:

1. **Store Document**: Upload your document to Walrus
2. **Get Link**: Receive a Walrus URL (e.g., `https://walrus.site/blob-id`)
3. **Add Metadata**: Prepare title and description for your document
4. **Add to List**: Use `add_document()` to store the complete document info on-chain
5. **Access**: Anyone can retrieve all document metadata using `get_all_documents()`

## 📁 Project Structure

```
documents_list/
├── README.md                    # This file
├── Move.toml                    # Package configuration
├── sources/
│   └── documents_list.move      # Main smart contract
└── tests/
    └── documents_list_test.move # Test suite
```

## 🎯 Document Schema

Each document in the list contains:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | String | Document title | "Blockchain Research Paper" |
| `description` | String | Document description | "Comprehensive analysis of consensus mechanisms" |
| `link` | String | Walrus storage URL | "https://walrus.site/abc123..." |

## 🏷️ Version

- **Sui Move Edition**: 2024.beta
- **Network**: Compatible with Sui testnet/mainnet
- **Package Name**: `documents_list`

## 📝 Example Use Cases

- **Academic Papers**: Store research papers with titles and abstracts
- **Technical Documentation**: Organize guides and manuals with descriptions
- **Legal Documents**: Archive contracts and agreements with metadata
- **Media Files**: Store images, videos, or audio with descriptive information
- **Business Documents**: Manage reports, presentations, and proposals

## 📜 License

This project is part of the Sui-X-BSA-2025 hackathon submission.