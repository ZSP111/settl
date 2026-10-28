//! Data types stored by the contract and returned by its view functions.

use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, near};

/// Basis points in 100%. A split of 2,500 bp is 25%.
pub const TOTAL_BASIS_POINTS: u16 = 10_000;

/// Lifecycle of an invoice.
///
/// Unpaid ──pay──▶ Paid
///   │ └──pay (escrow)──▶ Escrowed ──release──▶ Paid
///   └──cancel──▶ Cancelled
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Unpaid,
    Escrowed,
    Paid,
    Cancelled,
}

/// One recipient of a payout and their share of the invoice amount.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Split {
    pub account_id: AccountId,
    /// Share in basis points (1 bp = 0.01%). All splits of an invoice add up to 10,000.
    pub basis_points: u16,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Invoice {
    pub id: u64,
    /// The freelancer who created the invoice.
    pub creator: AccountId,
    pub client_name: String,
    pub description: String,
    /// Amount in USDC base units (6 decimals): 25.00 USDC is 25_000_000.
    pub amount: U128,
    /// Unix time in milliseconds. Informational only: the contract does not enforce it.
    pub due_date: U64,
    pub splits: Vec<Split>,
    /// If true, the payment is held by the contract until the payer releases it.
    pub escrow: bool,
    pub status: Status,
    pub created_at: U64,
    pub payer: Option<AccountId>,
    pub paid_at: Option<U64>,
}
