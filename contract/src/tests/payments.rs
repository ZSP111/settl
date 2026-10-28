use near_sdk::json_types::{U64, U128};
use near_sdk::{Gas, NearToken, PromiseOrValue, PromiseResult};

use super::*;
use crate::payment::split_amounts;
use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;

// ---------- ft_on_transfer ----------

#[test]
fn pay_marks_invoice_paid_and_pays_creator() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);

    let refund = pay(&mut contract, INVOICE_AMOUNT, &id.to_string());

    assert_eq!(refund, 0);
    let invoice = contract.get_invoice(id).unwrap();
    assert_eq!(invoice.status, Status::Paid);
    assert_eq!(invoice.payer, Some(client()));
    assert_eq!(invoice.paid_at, Some(U64(1_700_000_000_000)));
    assert_eq!(scheduled_transfers(), vec![(alice(), INVOICE_AMOUNT)]);
}

#[test]
fn pay_splits_payout_between_recipients() {
    let mut contract = new_contract();
    let id = create_invoice_with_splits(
        &mut contract,
        vec![split(alice(), 7_000), split(bob(), 3_000)],
    );

    pay(&mut contract, INVOICE_AMOUNT, &id.to_string());

    assert_eq!(
        scheduled_transfers(),
        vec![(alice(), 17_500_000), (bob(), 7_500_000)]
    );
}

#[test]
fn pay_accepts_json_msg_with_payer() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);

    let msg = format!(r#"{{"invoice_id": {id}, "payer": "real-client.near"}}"#);
    pay(&mut contract, INVOICE_AMOUNT, &msg);

    let invoice = contract.get_invoice(id).unwrap();
    assert_eq!(invoice.status, Status::Paid);
    assert_eq!(invoice.payer, Some(account("real-client.near")));
}

#[test]
fn pay_escrow_invoice_holds_funds() {
    let mut contract = new_contract();
    let id = create_escrow_invoice(&mut contract);

    pay(&mut contract, INVOICE_AMOUNT, &id.to_string());

    let invoice = contract.get_invoice(id).unwrap();
    assert_eq!(invoice.status, Status::Escrowed);
    assert_eq!(invoice.payer, Some(client()));
    assert!(scheduled_transfers().is_empty());
}

#[test]
fn pay_with_too_little_gas_credits_pending_balances() {
    let mut contract = new_contract();
    let id = create_invoice_with_splits(
        &mut contract,
        vec![split(alice(), 7_000), split(bob(), 3_000)],
    );

    set_caller_with_gas(&usdc(), NearToken::from_yoctonear(0), Gas::from_tgas(20));
    let result = contract.ft_on_transfer(client(), U128(INVOICE_AMOUNT), id.to_string());

    assert!(matches!(result, PromiseOrValue::Value(U128(0))));
    assert_eq!(contract.get_invoice(id).unwrap().status, Status::Paid);
    assert!(scheduled_transfers().is_empty());
    assert_eq!(contract.get_pending_balance(alice()), U128(17_500_000));
    assert_eq!(contract.get_pending_balance(bob()), U128(7_500_000));
}

#[test]
#[should_panic(expected = "Only USDC is accepted")]
fn pay_rejects_other_tokens() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);

    set_caller(&account("fake-usdc.testnet"), NearToken::from_yoctonear(0));
    let _ = contract.ft_on_transfer(client(), U128(INVOICE_AMOUNT), id.to_string());
}

#[test]
#[should_panic(expected = "Invalid msg")]
fn pay_rejects_invalid_msg() {
    let mut contract = new_contract();
    create_simple_invoice(&mut contract);
    pay(&mut contract, INVOICE_AMOUNT, "hello");
}

#[test]
#[should_panic(expected = "Invoice not found")]
fn pay_rejects_unknown_invoice() {
    let mut contract = new_contract();
    pay(&mut contract, INVOICE_AMOUNT, "42");
}

#[test]
#[should_panic(expected = "Amount does not match the invoice")]
fn pay_rejects_underpayment() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);
    pay(&mut contract, INVOICE_AMOUNT - 1, &id.to_string());
}

#[test]
#[should_panic(expected = "Amount does not match the invoice")]
fn pay_rejects_overpayment() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);
    pay(&mut contract, INVOICE_AMOUNT + 1, &id.to_string());
}

#[test]
#[should_panic(expected = "Invoice is not awaiting payment")]
fn pay_rejects_paying_twice() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);
    pay(&mut contract, INVOICE_AMOUNT, &id.to_string());
    pay(&mut contract, INVOICE_AMOUNT, &id.to_string());
}

#[test]
#[should_panic(expected = "Invoice is not awaiting payment")]
fn pay_rejects_cancelled_invoice() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);
    set_caller(&alice(), NearToken::from_yoctonear(0));
    contract.cancel_invoice(id);
    pay(&mut contract, INVOICE_AMOUNT, &id.to_string());
}

// ---------- release_escrow ----------

#[test]
fn release_escrow_pays_out() {
    let mut contract = new_contract();
    let id = create_escrow_invoice(&mut contract);
    pay(&mut contract, INVOICE_AMOUNT, &id.to_string());

    set_caller(&client(), NearToken::from_yoctonear(0));
    contract.release_escrow(id);

    assert_eq!(contract.get_invoice(id).unwrap().status, Status::Paid);
    assert_eq!(scheduled_transfers(), vec![(alice(), INVOICE_AMOUNT)]);
}

#[test]
#[should_panic(expected = "Only the payer can release this escrow")]
fn release_escrow_rejects_non_payer() {
    let mut contract = new_contract();
    let id = create_escrow_invoice(&mut contract);
    pay(&mut contract, INVOICE_AMOUNT, &id.to_string());

    set_caller(&alice(), NearToken::from_yoctonear(0));
    contract.release_escrow(id);
}

#[test]
#[should_panic(expected = "Only the payer can release this escrow")]
fn release_escrow_rejects_unpaid_invoice() {
    let mut contract = new_contract();
    let id = create_escrow_invoice(&mut contract);

    set_caller(&client(), NearToken::from_yoctonear(0));
    contract.release_escrow(id);
}

#[test]
#[should_panic(expected = "Invoice is not in escrow")]
fn release_escrow_rejects_releasing_twice() {
    let mut contract = new_contract();
    let id = create_escrow_invoice(&mut contract);
    pay(&mut contract, INVOICE_AMOUNT, &id.to_string());

    set_caller(&client(), NearToken::from_yoctonear(0));
    contract.release_escrow(id);
    contract.release_escrow(id);
}

// ---------- cancel_invoice ----------

#[test]
fn cancel_invoice_marks_cancelled() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);

    set_caller(&alice(), NearToken::from_yoctonear(0));
    contract.cancel_invoice(id);

    assert_eq!(contract.get_invoice(id).unwrap().status, Status::Cancelled);
}

#[test]
#[should_panic(expected = "Only the creator can cancel this invoice")]
fn cancel_invoice_rejects_non_creator() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);

    set_caller(&bob(), NearToken::from_yoctonear(0));
    contract.cancel_invoice(id);
}

#[test]
#[should_panic(expected = "Only unpaid invoices can be cancelled")]
fn cancel_invoice_rejects_paid_invoice() {
    let mut contract = new_contract();
    let id = create_simple_invoice(&mut contract);
    pay(&mut contract, INVOICE_AMOUNT, &id.to_string());

    set_caller(&alice(), NearToken::from_yoctonear(0));
    contract.cancel_invoice(id);
}

#[test]
#[should_panic(expected = "Invoice not found")]
fn cancel_invoice_rejects_unknown_invoice() {
    let mut contract = new_contract();
    contract.cancel_invoice(42);
}

// ---------- on_transfer_complete ----------

#[test]
fn failed_transfer_is_kept_as_pending_balance() {
    let mut contract = new_contract();

    set_callback_result(PromiseResult::Failed);
    contract.on_transfer_complete(
        alice(),
        U128(5_000_000),
        Err(near_sdk::PromiseError::Failed),
    );

    assert_eq!(contract.get_pending_balance(alice()), U128(5_000_000));
}

#[test]
fn successful_transfer_leaves_no_pending_balance() {
    let mut contract = new_contract();

    set_callback_result(PromiseResult::Successful(vec![]));
    contract.on_transfer_complete(alice(), U128(5_000_000), Ok(()));

    assert_eq!(contract.get_pending_balance(alice()), U128(0));
}

// ---------- withdraw ----------

#[test]
fn withdraw_sends_pending_balance() {
    let mut contract = new_contract();
    set_callback_result(PromiseResult::Failed);
    contract.on_transfer_complete(
        alice(),
        U128(5_000_000),
        Err(near_sdk::PromiseError::Failed),
    );

    set_caller(&alice(), NearToken::from_yoctonear(0));
    let _ = contract.withdraw();

    assert_eq!(contract.get_pending_balance(alice()), U128(0));
    assert_eq!(scheduled_transfers(), vec![(alice(), 5_000_000)]);
}

#[test]
#[should_panic(expected = "Nothing to withdraw")]
fn withdraw_rejects_empty_balance() {
    let mut contract = new_contract();
    set_caller(&alice(), NearToken::from_yoctonear(0));
    let _ = contract.withdraw();
}

// ---------- split_amounts ----------

#[test]
fn split_amounts_gives_rounding_remainder_to_first_split() {
    let splits = vec![
        split(alice(), 3_333),
        split(bob(), 3_333),
        split(client(), 3_334),
    ];
    let shares = split_amounts(10, &splits);
    assert_eq!(shares, vec![(alice(), 4), (bob(), 3), (client(), 3)]);
}
