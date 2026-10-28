//! Settl: crypto invoices for freelancers.
//!
//! A freelancer creates an invoice, the client pays it in USDC with `ft_transfer_call`,
//! and the contract pays the freelancer (optionally split between several accounts,
//! optionally held in escrow until the client approves).

mod invoice;
mod payment;

use std::collections::HashSet;

use near_sdk::json_types::{U64, U128};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{
    AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise, env, near, require,
};

pub use crate::invoice::{Invoice, Split, Status, TOTAL_BASIS_POINTS};

pub const MAX_SPLITS: usize = 5;
pub const MAX_CLIENT_NAME_LEN: usize = 100;
pub const MAX_DESCRIPTION_LEN: usize = 1_000;
const DEFAULT_PAGE_SIZE: u32 = 50;
const MAX_PAGE_SIZE: u32 = 100;

/// Prefixes that keep each on-chain collection's keys separate in storage.
#[near]
#[derive(BorshStorageKey)]
enum StorageKey {
    Invoices,
    InvoicesByCreator,
    PendingBalances,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// The NEP-141 token accepted as payment (USDC).
    usdc_contract: AccountId,
    next_invoice_id: u64,
    invoices: IterableMap<u64, Invoice>,
    /// Invoice ids per freelancer, oldest first.
    invoices_by_creator: LookupMap<AccountId, Vec<u64>>,
    /// USDC (base units) owed to accounts whose payout could not be sent automatically,
    /// e.g. because they were not registered on the USDC contract. Claimed with `withdraw`.
    pending_balances: LookupMap<AccountId, u128>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(usdc_contract: AccountId) -> Self {
        Self {
            usdc_contract,
            next_invoice_id: 1,
            invoices: IterableMap::new(StorageKey::Invoices),
            invoices_by_creator: LookupMap::new(StorageKey::InvoicesByCreator),
            pending_balances: LookupMap::new(StorageKey::PendingBalances),
        }
    }

    /// Creates an invoice and returns its id.
    ///
    /// The caller pays for the storage the invoice uses (a fraction of a NEAR):
    /// attach enough deposit and the unused part is refunded.
    #[payable]
    pub fn create_invoice(
        &mut self,
        client_name: String,
        description: String,
        amount: U128,
        due_date: U64,
        splits: Vec<Split>,
        escrow: bool,
    ) -> u64 {
        require!(amount.0 > 0, "Amount must be greater than zero");
        require!(
            client_name.len() <= MAX_CLIENT_NAME_LEN,
            "Client name is too long"
        );
        require!(
            description.len() <= MAX_DESCRIPTION_LEN,
            "Description is too long"
        );
        assert_valid_splits(&splits);

        let storage_before = env::storage_usage();
        let creator = env::predecessor_account_id();
        let id = self.next_invoice_id;
        self.next_invoice_id += 1;

        self.invoices.insert(
            id,
            Invoice {
                id,
                creator: creator.clone(),
                client_name,
                description,
                amount,
                due_date,
                splits,
                escrow,
                status: Status::Unpaid,
                created_at: U64(env::block_timestamp_ms()),
                payer: None,
                paid_at: None,
            },
        );
        self.invoices_by_creator
            .entry(creator.clone())
            .or_default()
            .push(id);
        // Write to storage now so the storage measurement below is accurate.
        self.invoices.flush();
        self.invoices_by_creator.flush();

        charge_for_storage(storage_before, creator);
        id
    }

    /// Cancels an unpaid invoice. Only its creator can do this.
    pub fn cancel_invoice(&mut self, invoice_id: u64) {
        let invoice = self.invoice_mut(invoice_id);
        require!(
            invoice.creator == env::predecessor_account_id(),
            "Only the creator can cancel this invoice"
        );
        require!(
            invoice.status == Status::Unpaid,
            "Only unpaid invoices can be cancelled"
        );
        invoice.status = Status::Cancelled;
    }

    // ---------- Views (free, no wallet needed) ----------

    pub fn get_invoice(&self, invoice_id: u64) -> Option<Invoice> {
        self.invoices.get(&invoice_id).cloned()
    }

    /// Invoices created by `account_id`, newest first.
    pub fn get_invoices_by_creator(
        &self,
        account_id: AccountId,
        from_index: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<Invoice> {
        let Some(ids) = self.invoices_by_creator.get(&account_id) else {
            return vec![];
        };
        let limit = limit.unwrap_or(DEFAULT_PAGE_SIZE).min(MAX_PAGE_SIZE);
        ids.iter()
            .rev()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit as usize)
            .filter_map(|id| self.invoices.get(id).cloned())
            .collect()
    }

    pub fn get_usdc_contract(&self) -> AccountId {
        self.usdc_contract.clone()
    }

    /// USDC waiting to be claimed by `account_id` with `withdraw`.
    pub fn get_pending_balance(&self, account_id: AccountId) -> U128 {
        U128(self.pending_balances.get(&account_id).copied().unwrap_or(0))
    }
}

impl Contract {
    /// Looks up an invoice for modification, panicking if it doesn't exist.
    fn invoice_mut(&mut self, invoice_id: u64) -> &mut Invoice {
        self.invoices
            .get_mut(&invoice_id)
            .unwrap_or_else(|| env::panic_str("Invoice not found"))
    }
}

/// Panics unless the splits are 1..=MAX_SPLITS distinct accounts with positive
/// shares adding up to exactly 100%.
fn assert_valid_splits(splits: &[Split]) {
    require!(!splits.is_empty(), "At least one split is required");
    require!(splits.len() <= MAX_SPLITS, "Too many splits");

    let mut seen = HashSet::new();
    let mut total: u32 = 0;
    for split in splits {
        require!(
            split.basis_points > 0,
            "Each split must be greater than zero"
        );
        require!(
            seen.insert(&split.account_id),
            "Duplicate account in splits"
        );
        total += u32::from(split.basis_points);
    }
    require!(
        total == u32::from(TOTAL_BASIS_POINTS),
        "Splits must add up to 10000 basis points"
    );
}

/// Makes the caller pay for the storage added since `storage_before` and refunds
/// whatever they attached beyond that.
fn charge_for_storage(storage_before: u64, payer: AccountId) {
    let bytes_used = env::storage_usage().saturating_sub(storage_before);
    let cost = env::storage_byte_cost().saturating_mul(u128::from(bytes_used));
    let attached = env::attached_deposit();
    require!(
        attached >= cost,
        format!(
            "Attach at least {} yoctoNEAR to cover storage",
            cost.as_yoctonear()
        )
    );
    let refund = attached.saturating_sub(cost);
    if refund > NearToken::from_yoctonear(0) {
        Promise::new(payer).transfer(refund).detach();
    }
}

#[cfg(test)]
mod tests;
