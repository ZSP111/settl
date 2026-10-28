use near_sdk::json_types::{U64, U128};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{AccountId, NearToken, testing_env};

use super::*;

fn account(name: &str) -> AccountId {
    name.parse().unwrap()
}

fn usdc() -> AccountId {
    account("usdc.testnet")
}

fn alice() -> AccountId {
    account("alice.testnet")
}

fn bob() -> AccountId {
    account("bob.testnet")
}

/// Sets up the blockchain context: `caller` is calling the contract with `deposit` attached.
fn set_caller(caller: &AccountId, deposit: NearToken) {
    let context = VMContextBuilder::new()
        .current_account_id(account("settl.testnet"))
        .predecessor_account_id(caller.clone())
        .signer_account_id(caller.clone())
        .attached_deposit(deposit)
        .block_timestamp(1_700_000_000_000_000_000)
        .build();
    testing_env!(context);
}

fn new_contract() -> Contract {
    set_caller(&alice(), NearToken::from_near(0));
    Contract::new(usdc())
}

fn split(account_id: AccountId, basis_points: u16) -> Split {
    Split {
        account_id,
        basis_points,
    }
}

/// Alice creates a 25 USDC invoice paid 100% to herself.
fn create_simple_invoice(contract: &mut Contract) -> u64 {
    create_invoice_with_splits(contract, vec![split(alice(), 10_000)])
}

fn create_invoice_with_splits(contract: &mut Contract, splits: Vec<Split>) -> u64 {
    set_caller(&alice(), NearToken::from_millinear(100));
    contract.create_invoice(
        "Acme Ltd".to_string(),
        "Logo design".to_string(),
        U128(25_000_000),
        U64(1_800_000_000_000),
        splits,
        false,
    )
}

// ---------- new ----------

#[test]
fn new_stores_usdc_contract() {
    let contract = new_contract();
    assert_eq!(contract.get_usdc_contract(), usdc());
}

// ---------- create_invoice ----------

#[test]
fn create_invoice_stores_all_fields() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);

    let invoice = contract.get_invoice(id).expect("invoice exists");
    assert_eq!(invoice.id, id);
    assert_eq!(invoice.creator, alice());
    assert_eq!(invoice.client_name, "Acme Ltd");
    assert_eq!(invoice.description, "Logo design");
    assert_eq!(invoice.amount, U128(25_000_000));
    assert_eq!(invoice.due_date, U64(1_800_000_000_000));
    assert_eq!(invoice.splits, vec![split(alice(), 10_000)]);
    assert!(!invoice.escrow);
    assert_eq!(invoice.status, Status::Unpaid);
    assert_eq!(invoice.created_at, U64(1_700_000_000_000));
    assert_eq!(invoice.payer, None);
    assert_eq!(invoice.paid_at, None);
}

#[test]
fn create_invoice_ids_increment() {
    let mut contract = new_contract();
    assert_eq!(create_simple_invoice(&mut contract), 1);
    assert_eq!(create_simple_invoice(&mut contract), 2);
}

#[test]
fn create_invoice_accepts_multiple_splits() {
    let mut contract = new_contract();
    let splits = vec![split(alice(), 7_000), split(bob(), 3_000)];
    let id = create_invoice_with_splits(&mut contract, splits.clone());
    assert_eq!(contract.get_invoice(id).unwrap().splits, splits);
}

#[test]
#[should_panic(expected = "Amount must be greater than zero")]
fn create_invoice_rejects_zero_amount() {
    let mut contract = new_contract();
    set_caller(&alice(), NearToken::from_millinear(100));
    contract.create_invoice(
        "Acme".to_string(),
        "Work".to_string(),
        U128(0),
        U64(0),
        vec![split(alice(), 10_000)],
        false,
    );
}

#[test]
#[should_panic(expected = "Client name is too long")]
fn create_invoice_rejects_long_client_name() {
    let mut contract = new_contract();
    set_caller(&alice(), NearToken::from_millinear(100));
    contract.create_invoice(
        "x".repeat(MAX_CLIENT_NAME_LEN + 1),
        "Work".to_string(),
        U128(1),
        U64(0),
        vec![split(alice(), 10_000)],
        false,
    );
}

#[test]
#[should_panic(expected = "Description is too long")]
fn create_invoice_rejects_long_description() {
    let mut contract = new_contract();
    set_caller(&alice(), NearToken::from_millinear(100));
    contract.create_invoice(
        "Acme".to_string(),
        "x".repeat(MAX_DESCRIPTION_LEN + 1),
        U128(1),
        U64(0),
        vec![split(alice(), 10_000)],
        false,
    );
}

#[test]
#[should_panic(expected = "At least one split is required")]
fn create_invoice_rejects_empty_splits() {
    let mut contract = new_contract();
    create_invoice_with_splits(&mut contract, vec![]);
}

#[test]
#[should_panic(expected = "Splits must add up to 10000 basis points")]
fn create_invoice_rejects_splits_under_100_percent() {
    let mut contract = new_contract();
    create_invoice_with_splits(
        &mut contract,
        vec![split(alice(), 6_000), split(bob(), 3_000)],
    );
}

#[test]
#[should_panic(expected = "Splits must add up to 10000 basis points")]
fn create_invoice_rejects_splits_over_100_percent() {
    let mut contract = new_contract();
    create_invoice_with_splits(
        &mut contract,
        vec![split(alice(), 8_000), split(bob(), 3_000)],
    );
}

#[test]
#[should_panic(expected = "Each split must be greater than zero")]
fn create_invoice_rejects_zero_split() {
    let mut contract = new_contract();
    create_invoice_with_splits(&mut contract, vec![split(alice(), 10_000), split(bob(), 0)]);
}

#[test]
#[should_panic(expected = "Duplicate account in splits")]
fn create_invoice_rejects_duplicate_split_accounts() {
    let mut contract = new_contract();
    create_invoice_with_splits(
        &mut contract,
        vec![split(alice(), 5_000), split(alice(), 5_000)],
    );
}

#[test]
#[should_panic(expected = "Too many splits")]
fn create_invoice_rejects_too_many_splits() {
    let mut contract = new_contract();
    let splits = (0..=MAX_SPLITS)
        .map(|i| split(account(&format!("user{i}.testnet")), 1_000))
        .collect();
    create_invoice_with_splits(&mut contract, splits);
}

#[test]
#[should_panic(expected = "to cover storage")]
fn create_invoice_requires_storage_deposit() {
    let mut contract = new_contract();
    set_caller(&alice(), NearToken::from_yoctonear(0));
    contract.create_invoice(
        "Acme".to_string(),
        "Work".to_string(),
        U128(1),
        U64(0),
        vec![split(alice(), 10_000)],
        false,
    );
}

// ---------- get_invoice ----------

#[test]
fn get_invoice_returns_none_for_unknown_id() {
    let contract = new_contract();
    assert_eq!(contract.get_invoice(42), None);
}

// ---------- get_invoices_by_creator ----------

#[test]
fn get_invoices_by_creator_returns_newest_first() {
    let mut contract = new_contract();
    for _ in 0..3 {
        create_simple_invoice(&mut contract);
    }
    let ids: Vec<u64> = contract
        .get_invoices_by_creator(alice(), None, None)
        .iter()
        .map(|invoice| invoice.id)
        .collect();
    assert_eq!(ids, vec![3, 2, 1]);
}

#[test]
fn get_invoices_by_creator_paginates() {
    let mut contract = new_contract();
    for _ in 0..5 {
        create_simple_invoice(&mut contract);
    }
    let ids: Vec<u64> = contract
        .get_invoices_by_creator(alice(), Some(1), Some(2))
        .iter()
        .map(|invoice| invoice.id)
        .collect();
    assert_eq!(ids, vec![4, 3]);
}

#[test]
fn get_invoices_by_creator_only_returns_own_invoices() {
    let mut contract = new_contract();
    create_simple_invoice(&mut contract);
    assert!(
        contract
            .get_invoices_by_creator(bob(), None, None)
            .is_empty()
    );
}
