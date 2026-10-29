use near_sdk::NearToken;
use near_sdk::json_types::{U64, U128};

use super::*;
use crate::sponsor::MAX_SPONSORED_INVOICES_PER_ACCOUNT;

/// Bob puts `near` NEAR into the sponsor pool.
fn fund_pool(contract: &mut Contract, near: u128) {
    set_caller(&bob(), NearToken::from_near(near));
    contract.fund_sponsor_pool();
}

/// Alice creates an invoice attaching no deposit, so the pool pays for storage.
fn create_sponsored_invoice(contract: &mut Contract) -> u64 {
    set_caller(&alice(), NearToken::from_yoctonear(0));
    contract.create_invoice(
        "Acme".to_string(),
        "Work".to_string(),
        U128(1_000_000),
        U64(0),
        vec![split(alice(), 10_000)],
        false,
    )
}

#[test]
fn fund_sponsor_pool_adds_deposit() {
    let mut contract = new_contract();
    fund_pool(&mut contract, 2);
    fund_pool(&mut contract, 1);
    assert_eq!(
        contract.get_sponsor_pool(),
        U128(NearToken::from_near(3).as_yoctonear())
    );
}

#[test]
#[should_panic(expected = "Attach NEAR to fund the sponsor pool")]
fn fund_sponsor_pool_rejects_zero() {
    let mut contract = new_contract();
    fund_pool(&mut contract, 0);
}

#[test]
fn sponsored_invoice_is_paid_from_pool() {
    let mut contract = new_contract();
    fund_pool(&mut contract, 1);

    let id = create_sponsored_invoice(&mut contract);

    assert_eq!(contract.get_invoice(id).unwrap().creator, alice());
    let pool = contract.get_sponsor_pool().0;
    assert!(
        pool < NearToken::from_near(1).as_yoctonear(),
        "storage was paid from the pool"
    );
    assert!(
        pool > NearToken::from_millinear(990).as_yoctonear(),
        "an invoice costs far less than 0.01 NEAR"
    );
    assert_eq!(
        contract.get_sponsored_invoices_left(alice()),
        MAX_SPONSORED_INVOICES_PER_ACCOUNT - 1
    );
}

#[test]
fn deposit_paid_invoice_leaves_pool_untouched() {
    let mut contract = new_contract();
    fund_pool(&mut contract, 1);

    create_simple_invoice(&mut contract);

    assert_eq!(
        contract.get_sponsor_pool(),
        U128(NearToken::from_near(1).as_yoctonear())
    );
    assert_eq!(
        contract.get_sponsored_invoices_left(alice()),
        MAX_SPONSORED_INVOICES_PER_ACCOUNT
    );
}

#[test]
#[should_panic(expected = "The sponsor pool is empty")]
fn sponsored_invoice_rejects_empty_pool() {
    let mut contract = new_contract();
    create_sponsored_invoice(&mut contract);
}

#[test]
#[should_panic(expected = "No sponsored invoices left for this account")]
fn sponsored_invoices_are_capped_per_account() {
    let mut contract = new_contract();
    fund_pool(&mut contract, 1);
    for _ in 0..=MAX_SPONSORED_INVOICES_PER_ACCOUNT {
        create_sponsored_invoice(&mut contract);
    }
}
