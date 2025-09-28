#[test_only]
module documents_list::documents_list_tests;

use documents_list::documents_list;
use std::string;

#[test]
fun test_global_documents_list() {
    use sui::test_scenario::{Self as ts};
    
    let owner = @0x1;
    let user1 = @0x2;
    let user2 = @0x3;
    
    // Start test scenario
    let mut scenario = ts::begin(owner);
    
    // Owner publishes the contract (creates shared list for testing)
    {
        ts::next_tx(&mut scenario, owner);
        documents_list::create_for_testing(ts::ctx(&mut scenario));
    };
    
    // User1 adds a document
    {
        ts::next_tx(&mut scenario, user1);
        let mut list = ts::take_shared<documents_list::DocumentsList>(&scenario);
        let success = documents_list::add_document(
            &mut list, 
            string::utf8(b"Research Paper"), 
            string::utf8(b"A comprehensive study on blockchain technology"), 
            string::utf8(b"https://walrus.site/doc1")
        );
        assert!(success == true, 0);
        ts::return_shared(list);
    };
    
    // User2 adds another document  
    {
        ts::next_tx(&mut scenario, user2);
        let mut list = ts::take_shared<documents_list::DocumentsList>(&scenario);
        documents_list::add_document(
            &mut list, 
            string::utf8(b"Technical Guide"), 
            string::utf8(b"How to use Walrus storage system"), 
            string::utf8(b"https://walrus.site/doc2")
        );
        ts::return_shared(list);
    };
    
    // Anyone can read all documents
    {
        ts::next_tx(&mut scenario, user1);
        let list = ts::take_shared<documents_list::DocumentsList>(&scenario);
        let all_docs = documents_list::get_all_documents(&list);
        let count = documents_list::get_document_count(&list);
        
        assert!(vector::length(&all_docs) == 2, 1);
        assert!(count == 2, 2);
        
        ts::return_shared(list);
    };
    
    ts::end(scenario);
}
