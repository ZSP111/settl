use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{NearToken, env};

use super::*;
use crate::migrate::ContractV1;

#[test]
fn migrate_keeps_invoices_and_adds_empty_sponsor_pool() {
    // Build state the way the previous version stored it, with one invoice.
    let mut old_contract = new_contract();
    let id = create_simple_invoice(&mut old_contract);
    let invoice = old_contract.get_invoice(id).unwrap();

    let mut v1 = ContractV1 {
        usdc_contract: usdc(),
        next_invoice_id: 2,
        invoices: IterableMap::new(b"v1i".to_vec()),
        invoices_by_creator: LookupMap::new(b"v1c".to_vec()),
        pending_balances: LookupMap::new(b"v1p".to_vec()),
    };
    v1.invoices.insert(id, invoice.clone());
    v1.invoices_by_creator.insert(alice(), vec![id]);
    v1.invoices.flush();
    v1.invoices_by_creator.flush();
    env::state_write(&v1);

    set_caller(&settl(), NearToken::from_yoctonear(0));
    let migrated = Contract::migrate();

    assert_eq!(migrated.get_invoice(id), Some(invoice));
    assert_eq!(
        migrated.get_invoices_by_creator(alice(), None, None).len(),
        1
    );
    assert_eq!(migrated.get_usdc_contract(), usdc());
    assert_eq!(migrated.get_sponsor_pool().0, 0);
}

// `#[private]` on `migrate` is enforced by the generated wasm entry point, which unit tests
// bypass; it is checked on testnet instead (calling migrate from another account fails).
