//! State migration. On NEAR, upgrading a contract's code keeps its stored state as raw bytes.
//! When the shape of `Contract` changes, the new code can't read the old bytes, so `migrate`
//! reads the previous shape and writes the new one. Call it once, right after deploying.

use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{AccountId, NearToken, env, near};

use crate::{Contract, ContractExt, Invoice, StorageKey};

/// `Contract` as deployed before sponsored storage was added.
#[near]
pub struct ContractV1 {
    pub(crate) usdc_contract: AccountId,
    pub(crate) next_invoice_id: u64,
    pub(crate) invoices: IterableMap<u64, Invoice>,
    pub(crate) invoices_by_creator: LookupMap<AccountId, Vec<u64>>,
    pub(crate) pending_balances: LookupMap<AccountId, u128>,
}

#[near]
impl Contract {
    /// Upgrades the state from `ContractV1`. Only the contract account itself can call it.
    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        let old: ContractV1 =
            env::state_read().unwrap_or_else(|| env::panic_str("No state to migrate"));
        Self {
            usdc_contract: old.usdc_contract,
            next_invoice_id: old.next_invoice_id,
            invoices: old.invoices,
            invoices_by_creator: old.invoices_by_creator,
            pending_balances: old.pending_balances,
            sponsor_pool: NearToken::from_yoctonear(0),
            sponsored_invoices: LookupMap::new(StorageKey::SponsoredInvoices),
        }
    }
}
