//! Receiving USDC for an invoice and paying it out to the invoice's splits.
//!
//! A client pays by calling `ft_transfer_call` on the USDC contract with the invoice id
//! in `msg`. USDC moves the tokens to Settl and then calls our `ft_on_transfer`.
//! If `ft_on_transfer` panics, the USDC contract refunds the payment automatically.

use near_contract_standards::fungible_token::core::ext_ft_core;
use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;
use near_sdk::json_types::{U64, U128};
use near_sdk::{
    AccountId, Gas, NearToken, Promise, PromiseError, PromiseOrValue, env, near, require,
    serde_json,
};

use crate::{Contract, ContractExt, Split, Status, TOTAL_BASIS_POINTS};

/// Gas for one `ft_transfer` on the USDC contract.
const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(10);
/// Gas for our `on_transfer_complete` callback after each transfer.
const GAS_FOR_TRANSFER_CALLBACK: Gas = Gas::from_tgas(5);
/// Gas kept back to finish the current call after scheduling the payouts.
const GAS_RESERVE: Gas = Gas::from_tgas(10);
/// NEP-141 requires exactly 1 yoctoNEAR on `ft_transfer`, as proof of a full-access signature.
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

/// What `msg` in `ft_transfer_call` carries: either just the invoice id (`"12"`) or JSON
/// (`{"invoice_id": 12, "payer": "client.near"}`). `payer` is for payments relayed through
/// NEAR Intents, where the sender is the Intents contract rather than the client.
#[near(serializers = [json])]
struct PaymentMsg {
    invoice_id: u64,
    payer: Option<AccountId>,
}

fn parse_payment_msg(msg: &str) -> PaymentMsg {
    if let Ok(invoice_id) = msg.trim().parse::<u64>() {
        return PaymentMsg {
            invoice_id,
            payer: None,
        };
    }
    serde_json::from_str(msg)
        .unwrap_or_else(|_| env::panic_str("Invalid msg: expected an invoice id"))
}

#[near]
impl FungibleTokenReceiver for Contract {
    /// Called by the USDC contract after a client sends USDC with `ft_transfer_call`.
    /// Returns the amount to refund: always 0, because anything wrong panics (and USDC
    /// then refunds the whole payment).
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        require!(
            env::predecessor_account_id() == self.usdc_contract,
            "Only USDC is accepted"
        );
        let PaymentMsg { invoice_id, payer } = parse_payment_msg(&msg);

        let invoice = self.invoice_mut(invoice_id);
        require!(
            invoice.status == Status::Unpaid,
            "Invoice is not awaiting payment"
        );
        require!(
            amount == invoice.amount,
            "Amount does not match the invoice"
        );

        invoice.payer = Some(payer.unwrap_or(sender_id));
        invoice.paid_at = Some(U64(env::block_timestamp_ms()));
        if invoice.escrow {
            invoice.status = Status::Escrowed;
        } else {
            invoice.status = Status::Paid;
            let splits = invoice.splits.clone();
            self.pay_out(amount.0, &splits);
        }
        PromiseOrValue::Value(U128(0))
    }
}

#[near]
impl Contract {
    /// Releases an escrowed payment to the invoice's splits. Only the payer can do this,
    /// once they are happy with the work.
    pub fn release_escrow(&mut self, invoice_id: u64) {
        let invoice = self.invoice_mut(invoice_id);
        require!(
            invoice.payer.as_ref() == Some(&env::predecessor_account_id()),
            "Only the payer can release this escrow"
        );
        require!(
            invoice.status == Status::Escrowed,
            "Invoice is not in escrow"
        );
        invoice.status = Status::Paid;
        let (amount, splits) = (invoice.amount.0, invoice.splits.clone());
        self.pay_out(amount, &splits);
    }

    /// Sends the caller the USDC they are owed from payouts that could not be delivered.
    pub fn withdraw(&mut self) -> Promise {
        let account_id = env::predecessor_account_id();
        let amount = self.pending_balances.remove(&account_id).unwrap_or(0);
        require!(amount > 0, "Nothing to withdraw");
        self.transfer_usdc(account_id, amount)
    }

    /// Runs after each USDC transfer. If the transfer failed (for example the recipient
    /// is not registered on the USDC contract), the amount is kept for them to `withdraw`.
    #[private]
    pub fn on_transfer_complete(
        &mut self,
        account_id: AccountId,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) {
        if result.is_err() {
            self.credit_pending(&account_id, amount.0);
        }
    }
}

impl Contract {
    /// Sends each split its share of `amount`. If there isn't enough gas left to send
    /// them all, every share is credited to the recipient's pending balance instead.
    fn pay_out(&mut self, amount: u128, splits: &[Split]) {
        let shares = split_amounts(amount, splits);
        let gas_per_transfer = GAS_FOR_FT_TRANSFER.saturating_add(GAS_FOR_TRANSFER_CALLBACK);
        let gas_needed = gas_per_transfer
            .saturating_mul(shares.len() as u64)
            .saturating_add(GAS_RESERVE);
        let gas_left = env::prepaid_gas().saturating_sub(env::used_gas());

        for (account_id, share) in shares {
            if share == 0 {
                continue;
            }
            if gas_left >= gas_needed {
                self.transfer_usdc(account_id, share).detach();
            } else {
                self.credit_pending(&account_id, share);
            }
        }
    }

    /// `ft_transfer` of USDC from Settl to `account_id`, followed by `on_transfer_complete`.
    fn transfer_usdc(&self, account_id: AccountId, amount: u128) -> Promise {
        ext_ft_core::ext(self.usdc_contract.clone())
            .with_attached_deposit(ONE_YOCTO)
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .ft_transfer(
                account_id.clone(),
                U128(amount),
                Some("Settl payout".to_string()),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_TRANSFER_CALLBACK)
                    .on_transfer_complete(account_id, U128(amount)),
            )
    }

    fn credit_pending(&mut self, account_id: &AccountId, amount: u128) {
        *self.pending_balances.entry(account_id.clone()).or_insert(0) += amount;
    }
}

/// Divides `amount` between the splits by basis points, rounding each share down.
/// The rounding remainder goes to the first split, so the shares always add up to `amount`.
pub(crate) fn split_amounts(amount: u128, splits: &[Split]) -> Vec<(AccountId, u128)> {
    let mut shares: Vec<(AccountId, u128)> = splits
        .iter()
        .map(|split| {
            let share = amount
                .checked_mul(u128::from(split.basis_points))
                .unwrap_or_else(|| env::panic_str("Amount is too large"))
                / u128::from(TOTAL_BASIS_POINTS);
            (split.account_id.clone(), share)
        })
        .collect();

    let paid: u128 = shares.iter().map(|(_, share)| share).sum();
    if let Some((_, first)) = shares.first_mut() {
        *first += amount - paid;
    }
    shares
}
