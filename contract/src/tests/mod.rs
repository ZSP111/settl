//! Unit tests. Shared helpers live here; the tests are grouped by feature.

mod invoices;
mod migration;
mod payments;
mod sponsor;

use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;
use near_sdk::json_types::{U64, U128};
use near_sdk::mock::MockAction;
use near_sdk::test_utils::{VMContextBuilder, get_created_receipts};
use near_sdk::{AccountId, Gas, NearToken, PromiseOrValue, PromiseResult, serde_json, testing_env};

pub(crate) use crate::*;

pub(crate) fn account(name: &str) -> AccountId {
    name.parse().unwrap()
}

pub(crate) fn usdc() -> AccountId {
    account("usdc.testnet")
}

pub(crate) fn alice() -> AccountId {
    account("alice.testnet")
}

pub(crate) fn bob() -> AccountId {
    account("bob.testnet")
}

pub(crate) fn client() -> AccountId {
    account("client.testnet")
}

pub(crate) fn settl() -> AccountId {
    account("settl.testnet")
}

/// Sets up the blockchain context: `caller` is calling the contract with `deposit` attached.
pub(crate) fn set_caller(caller: &AccountId, deposit: NearToken) {
    set_caller_with_gas(caller, deposit, Gas::from_tgas(300));
}

pub(crate) fn set_caller_with_gas(caller: &AccountId, deposit: NearToken, gas: Gas) {
    let context = VMContextBuilder::new()
        .current_account_id(settl())
        .predecessor_account_id(caller.clone())
        .signer_account_id(caller.clone())
        .attached_deposit(deposit)
        .block_timestamp(1_700_000_000_000_000_000)
        .prepaid_gas(gas)
        .build();
    testing_env!(context);
}

pub(crate) fn new_contract() -> Contract {
    set_caller(&alice(), NearToken::from_near(0));
    Contract::new(usdc())
}

pub(crate) fn split(account_id: AccountId, basis_points: u16) -> Split {
    Split {
        account_id,
        basis_points,
    }
}

/// Alice creates a 25 USDC invoice paid 100% to herself.
pub(crate) fn create_simple_invoice(contract: &mut Contract) -> u64 {
    create_invoice_with_splits(contract, vec![split(alice(), 10_000)])
}

pub(crate) fn create_invoice_with_splits(contract: &mut Contract, splits: Vec<Split>) -> u64 {
    create_invoice_full(contract, splits, false)
}

/// Alice creates a 25 USDC escrow invoice paid 100% to herself.
pub(crate) fn create_escrow_invoice(contract: &mut Contract) -> u64 {
    create_invoice_full(contract, vec![split(alice(), 10_000)], true)
}

pub(crate) fn create_invoice_full(
    contract: &mut Contract,
    splits: Vec<Split>,
    escrow: bool,
) -> u64 {
    set_caller(&alice(), NearToken::from_millinear(100));
    contract.create_invoice(
        "Acme Ltd".to_string(),
        "Logo design".to_string(),
        U128(INVOICE_AMOUNT),
        U64(1_800_000_000_000),
        splits,
        escrow,
    )
}

/// 25.00 USDC in base units.
pub(crate) const INVOICE_AMOUNT: u128 = 25_000_000;

/// Simulates the USDC contract calling `ft_on_transfer` after `client` paid with `msg`.
/// Returns the amount the contract asked USDC to refund.
pub(crate) fn pay(contract: &mut Contract, amount: u128, msg: &str) -> u128 {
    set_caller(&usdc(), NearToken::from_yoctonear(0));
    match contract.ft_on_transfer(client(), U128(amount), msg.to_string()) {
        PromiseOrValue::Value(refund) => refund.0,
        PromiseOrValue::Promise(_) => panic!("expected a value"),
    }
}

/// The USDC transfers the contract scheduled during the last call, as (recipient, amount).
pub(crate) fn scheduled_transfers() -> Vec<(AccountId, u128)> {
    get_created_receipts()
        .into_iter()
        .filter(|receipt| receipt.receiver_id == usdc())
        .flat_map(|receipt| receipt.actions)
        .filter_map(|action| match action {
            MockAction::FunctionCallWeight {
                method_name, args, ..
            } if method_name == b"ft_transfer" => {
                let args: serde_json::Value = serde_json::from_slice(&args).unwrap();
                Some((
                    args["receiver_id"].as_str().unwrap().parse().unwrap(),
                    args["amount"].as_str().unwrap().parse().unwrap(),
                ))
            }
            _ => None,
        })
        .collect()
}

/// Sets up the context for a callback: the contract calls itself, and the previous
/// promise (the USDC transfer) ended with `result`.
pub(crate) fn set_callback_result(result: PromiseResult) {
    let context = VMContextBuilder::new()
        .current_account_id(settl())
        .predecessor_account_id(settl())
        .build();
    testing_env!(
        context,
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![result]
    );
}
