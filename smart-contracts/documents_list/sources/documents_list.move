/// Module: documents_list
/// A blockchain-like immutable list for storing Walrus documents with metadata
module documents_list::documents_list;

use std::string::String;

/// Document entry with title, description, and link
public struct Document has store, copy, drop {
    title: String,
    description: String,
    link: String
}

/// Global singleton documents list - only one exists per deployment
/// Acts like a blockchain: append-only, no deletions allowed
public struct DocumentsList has key {
    id: UID,
    items: vector<Document>
}

/// Initialize the global documents list (called once by owner during deployment)
/// This creates the single, shared list that everyone can add to
fun init(ctx: &mut TxContext) {
    let documents_list = DocumentsList {
        id: object::new(ctx),
        items: vector[]
    };
    // Share the object so anyone can add to it
    transfer::share_object(documents_list);
}

/// Add a new document to the global list
/// Anyone can call this function to append a document with title, description, and link
public fun add_document(
    documents_list: &mut DocumentsList, 
    title: String, 
    description: String, 
    link: String
): bool {
    let document = Document {
        title,
        description,
        link
    };
    documents_list.items.push_back(document);
    true
}

/// Get all documents from the global list  
/// Returns a copy of all stored documents - TypeScript compatible
public fun get_all_documents(documents_list: &DocumentsList): vector<Document> {
    documents_list.items
}

/// Get the total count of documents in the list
public fun get_document_count(documents_list: &DocumentsList): u64 {
    documents_list.items.length()
}

#[test_only]
/// Test helper function to create a shared DocumentsList for testing
public fun create_for_testing(ctx: &mut TxContext) {
    let documents_list = DocumentsList {
        id: object::new(ctx),
        items: vector[]
    };
    transfer::share_object(documents_list);
}