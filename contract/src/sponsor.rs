//! Sponsored storage: lets freelancers create invoices without holding any NEAR.
//!
//! Every invoice uses a little on-chain storage, which normally the creator pays for with a
//! deposit. Settl (or anyone) can put NEAR into a sponsor pool; an invoice created with no
//! deposit then has its storage paid from the pool. Combined with a relayer that pays gas
//! (NEAR meta transactions), creating an invoice costs the freelancer nothing.
//!
//! Each account gets a limited number of sponsored invoices, so one account can't drain the pool.

use near_sdk::json_types::U128;
use near_sdk::{AccountId, NearToken, env, near, require};

use crate::{Contract, ContractExt};

pub const MAX_SPONSORED_INVOICES_PER_ACCOUNT: u32 = 10;

#[near]
impl Contract {
    /// Adds the attached NEAR to the sponsor pool.
    #[payable]
    pub fn fund_sponsor_pool(&mut self) {
        let amount = env::attached_deposit();
        require!(!amount.is_zero(), "Attach NEAR to fund the sponsor pool");
        self.sponsor_pool = self.sponsor_pool.saturating_add(amount);
    }

    /// NEAR available to sponsor invoice storage, in yoctoNEAR.
    pub fn get_sponsor_pool(&self) -> U128 {
        U128(self.sponsor_pool.as_yoctonear())
    }

    /// How many more invoices `account_id` can create without attaching a deposit.
    pub fn get_sponsored_invoices_left(&self, account_id: AccountId) -> u32 {
        MAX_SPONSORED_INVOICES_PER_ACCOUNT.saturating_sub(self.sponsored_count(&account_id))
    }
}

impl Contract {
    fn sponsored_count(&self, account_id: &AccountId) -> u32 {
        self.sponsored_invoices
            .get(account_id)
            .copied()
            .unwrap_or(0)
    }

    /// Counts one sponsored invoice for `account_id`, panicking if they've used them all.
    pub(crate) fn use_sponsored_slot(&mut self, account_id: &AccountId) {
        let used = self.sponsored_count(account_id);
        require!(
            used < MAX_SPONSORED_INVOICES_PER_ACCOUNT,
            "No sponsored invoices left for this account: attach a deposit to pay for storage"
        );
        self.sponsored_invoices.insert(account_id.clone(), used + 1);
    }

    /// Pays `cost` of storage from the sponsor pool.
    pub(crate) fn pay_storage_from_pool(&mut self, cost: NearToken) {
        require!(
            self.sponsor_pool >= cost,
            "The sponsor pool is empty: attach a deposit to pay for storage"
        );
        self.sponsor_pool = self.sponsor_pool.saturating_sub(cost);
    }
}
