//! End-to-end tests on a local NEAR sandbox chain: real Settl and mock-USDC contracts,
//! real `ft_transfer_call` payments, real cross-contract payouts.
//!
//! Run with `cargo test --test payment_flow` (the first run downloads the sandbox binary).

use near_api::{AccountId, Contract, NearGas, NearToken, NetworkConfig, Signer};
use near_sdk::serde_json::{Value, json};
use std::sync::Arc;
use testresult::TestResult;

/// 1,000 USDC in base units, minted to the client.
const CLIENT_START_BALANCE: u128 = 1_000_000_000;
/// 25 USDC.
const INVOICE_AMOUNT: u128 = 25_000_000;

/// Everything a test needs: the chain, the two contracts and the people.
struct Env {
    _sandbox: near_sandbox::Sandbox,
    network: NetworkConfig,
    signer: Arc<Signer>,
    usdc: Contract,
    settl: Contract,
    alice: AccountId,
    bob: AccountId,
    client: AccountId,
}

impl Env {
    /// Starts a sandbox, deploys mock USDC (supply minted to the client) and Settl,
    /// and registers Settl, Alice and Bob on the USDC contract.
    async fn new() -> TestResult<Self> {
        let sandbox = near_sandbox::Sandbox::start_sandbox().await?;
        let network = NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse()?);
        // Every sandbox account below is created with the genesis key, so one signer works for all.
        let signer = Signer::from_secret_key(
            near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY.parse()?,
        )?;

        let usdc_id = create_account(&sandbox, "usdc.sandbox").await?;
        let settl_id = create_account(&sandbox, "settl.sandbox").await?;
        let alice = create_account(&sandbox, "alice.sandbox").await?;
        let bob = create_account(&sandbox, "bob.sandbox").await?;
        let client = create_account(&sandbox, "client.sandbox").await?;

        Contract::deploy(usdc_id.clone())
            .use_code(build_wasm("mock-usdc/Cargo.toml", true)?)
            .with_init_call(
                "new",
                json!({ "owner_id": client, "total_supply": CLIENT_START_BALANCE.to_string() }),
            )?
            .with_signer(signer.clone())
            .send_to(&network)
            .await?
            .assert_success();

        Contract::deploy(settl_id.clone())
            .use_code(build_wasm("Cargo.toml", false)?)
            .with_init_call("new", json!({ "usdc_contract": usdc_id }))?
            .with_signer(signer.clone())
            .send_to(&network)
            .await?
            .assert_success();

        let env = Self {
            _sandbox: sandbox,
            network,
            signer,
            usdc: Contract(usdc_id),
            settl: Contract(settl_id.clone()),
            alice: alice.clone(),
            bob: bob.clone(),
            client,
        };
        for account in [&settl_id, &alice, &bob] {
            env.register_on_usdc(account).await?;
        }
        Ok(env)
    }

    async fn register_on_usdc(&self, account_id: &AccountId) -> TestResult<()> {
        self.usdc
            .call_function("storage_deposit", json!({ "account_id": account_id }))
            .transaction()
            .deposit(NearToken::from_millinear(10))
            .with_signer(account_id.clone(), self.signer.clone())
            .send_to(&self.network)
            .await?
            .assert_success();
        Ok(())
    }

    /// Alice creates a 25 USDC invoice and returns its id.
    async fn create_invoice(&self, splits: Value, escrow: bool) -> TestResult<u64> {
        let id: u64 = self
            .settl
            .call_function(
                "create_invoice",
                json!({
                    "client_name": "Acme Ltd",
                    "description": "Logo design",
                    "amount": INVOICE_AMOUNT.to_string(),
                    "due_date": "1800000000000",
                    "splits": splits,
                    "escrow": escrow,
                }),
            )
            .transaction()
            .deposit(NearToken::from_millinear(100))
            .with_signer(self.alice.clone(), self.signer.clone())
            .send_to(&self.network)
            .await?
            .assert_success()
            .json()?;
        Ok(id)
    }

    /// The client pays `amount` USDC towards `invoice_id`, the way a wallet would.
    async fn pay(&self, invoice_id: u64, amount: u128) -> TestResult<()> {
        self.usdc
            .call_function(
                "ft_transfer_call",
                json!({
                    "receiver_id": self.settl.0,
                    "amount": amount.to_string(),
                    "msg": invoice_id.to_string(),
                }),
            )
            .transaction()
            .deposit(NearToken::from_yoctonear(1))
            .gas(NearGas::from_tgas(300))
            .with_signer(self.client.clone(), self.signer.clone())
            .send_to(&self.network)
            .await?
            .assert_success();
        Ok(())
    }

    async fn usdc_balance(&self, account_id: &AccountId) -> TestResult<u128> {
        let balance: String = self
            .usdc
            .call_function("ft_balance_of", json!({ "account_id": account_id }))
            .read_only()
            .fetch_from(&self.network)
            .await?
            .data;
        Ok(balance.parse()?)
    }

    async fn invoice_status(&self, invoice_id: u64) -> TestResult<String> {
        let invoice: Value = self
            .settl
            .call_function("get_invoice", json!({ "invoice_id": invoice_id }))
            .read_only()
            .fetch_from(&self.network)
            .await?
            .data;
        Ok(invoice["status"].as_str().unwrap().to_string())
    }
}

async fn create_account(sandbox: &near_sandbox::Sandbox, name: &str) -> TestResult<AccountId> {
    let account_id: AccountId = name.parse()?;
    sandbox
        .create_account(account_id.clone())
        .initial_balance(NearToken::from_near(10))
        .send()
        .await?;
    Ok(account_id)
}

/// Compiles a contract (path relative to `contract/`) to wasm with cargo-near.
fn build_wasm(manifest_path: &str, no_abi: bool) -> TestResult<Vec<u8>> {
    let opts = cargo_near_build::BuildOpts::builder()
        .manifest_path(manifest_path)
        .no_abi(no_abi)
        .build();
    let wasm_path = cargo_near_build::build_with_cli(opts)?;
    Ok(std::fs::read(wasm_path)?)
}

#[tokio::test]
async fn payment_is_split_between_recipients() -> TestResult<()> {
    let env = Env::new().await?;
    let id = env
        .create_invoice(
            json!([
                { "account_id": env.alice, "basis_points": 7000 },
                { "account_id": env.bob, "basis_points": 3000 },
            ]),
            false,
        )
        .await?;

    env.pay(id, INVOICE_AMOUNT).await?;

    assert_eq!(env.invoice_status(id).await?, "Paid");
    assert_eq!(env.usdc_balance(&env.alice).await?, 17_500_000);
    assert_eq!(env.usdc_balance(&env.bob).await?, 7_500_000);
    assert_eq!(env.usdc_balance(&env.settl.0).await?, 0);
    assert_eq!(
        env.usdc_balance(&env.client).await?,
        CLIENT_START_BALANCE - INVOICE_AMOUNT
    );
    Ok(())
}

#[tokio::test]
async fn wrong_amount_is_refunded_to_client() -> TestResult<()> {
    let env = Env::new().await?;
    let id = env
        .create_invoice(
            json!([{ "account_id": env.alice, "basis_points": 10000 }]),
            false,
        )
        .await?;

    env.pay(id, INVOICE_AMOUNT - 1).await?;

    assert_eq!(env.invoice_status(id).await?, "Unpaid");
    assert_eq!(env.usdc_balance(&env.client).await?, CLIENT_START_BALANCE);
    assert_eq!(env.usdc_balance(&env.alice).await?, 0);
    Ok(())
}

#[tokio::test]
async fn escrow_holds_funds_until_client_releases() -> TestResult<()> {
    let env = Env::new().await?;
    let id = env
        .create_invoice(
            json!([{ "account_id": env.alice, "basis_points": 10000 }]),
            true,
        )
        .await?;

    env.pay(id, INVOICE_AMOUNT).await?;
    assert_eq!(env.invoice_status(id).await?, "Escrowed");
    assert_eq!(env.usdc_balance(&env.settl.0).await?, INVOICE_AMOUNT);
    assert_eq!(env.usdc_balance(&env.alice).await?, 0);

    env.settl
        .call_function("release_escrow", json!({ "invoice_id": id }))
        .transaction()
        .gas(NearGas::from_tgas(100))
        .with_signer(env.client.clone(), env.signer.clone())
        .send_to(&env.network)
        .await?
        .assert_success();

    assert_eq!(env.invoice_status(id).await?, "Paid");
    assert_eq!(env.usdc_balance(&env.alice).await?, INVOICE_AMOUNT);
    assert_eq!(env.usdc_balance(&env.settl.0).await?, 0);
    Ok(())
}

#[tokio::test]
async fn unregistered_recipient_can_withdraw_later() -> TestResult<()> {
    let env = Env::new().await?;
    // Carol has not registered on the USDC contract, so her payout transfer will fail.
    let carol = create_account(&env._sandbox, "carol.sandbox").await?;
    let id = env
        .create_invoice(
            json!([
                { "account_id": env.alice, "basis_points": 5000 },
                { "account_id": carol, "basis_points": 5000 },
            ]),
            false,
        )
        .await?;

    env.pay(id, INVOICE_AMOUNT).await?;

    assert_eq!(env.usdc_balance(&env.alice).await?, 12_500_000);
    assert_eq!(env.usdc_balance(&carol).await?, 0);
    let pending: String = env
        .settl
        .call_function("get_pending_balance", json!({ "account_id": carol }))
        .read_only()
        .fetch_from(&env.network)
        .await?
        .data;
    assert_eq!(pending, "12500000");

    // Carol registers and withdraws her share.
    env.register_on_usdc(&carol).await?;
    env.settl
        .call_function("withdraw", json!({}))
        .transaction()
        .gas(NearGas::from_tgas(100))
        .with_signer(carol.clone(), env.signer.clone())
        .send_to(&env.network)
        .await?
        .assert_success();

    assert_eq!(env.usdc_balance(&carol).await?, 12_500_000);
    Ok(())
}
