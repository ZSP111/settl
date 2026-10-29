# Settl

Crypto invoices for freelancers, built at NEAR HACKATHON (Oct–Nov 2026).

A freelancer creates an invoice and gets a payment link. The client opens the link and pays in USDC,
and the freelancer receives USDC on NEAR. Payments can be split automatically between several accounts,
and can be held in escrow until the client approves the work.

> **Status: in development.** Done so far: the smart contract handles the full invoice lifecycle
> (create, pay in USDC, split payouts, escrow, cancel), and the web app covers create → share link →
> pay → receipt, plus a dashboard. **Live on NEAR testnet and mainnet.** Pay-with-any-crypto via NEAR Intents is built. See [Roadmap](#roadmap).

## Deployed
| Network | Settl contract | Payment token |
|---|---|---|
| Testnet | [`settl-billonaire.testnet`](https://testnet.nearblocks.io/address/settl-billonaire.testnet) | Circle USDC `3e2210e1…b8af` ([faucet](https://faucet.circle.com)) |
| Mainnet | [`settl-billonaire.near`](https://nearblocks.io/address/settl-billonaire.near) | Circle USDC `17208628…33a1` |

## The problem
Freelancers paid in crypto chase clients for the "right" token and chain, pay bridge and exchange fees,
and split money with collaborators by hand. Settl gives them one link that settles in a stablecoin
and splits the payout on-chain.

## NEAR tech used
| Tech | What it does in Settl | Status |
|---|---|---|
| Named accounts | The contract lives at a readable name, `settl-billonaire.testnet`, and invoices show freelancers by their account name instead of a hex address | ✅ |
| Rust smart contract (`near-sdk`) | Stores invoices, validates splits, receives USDC and pays it out | ✅ |
| Storage staking | The freelancer attaches a small NEAR deposit to pay for their invoice's on-chain storage; the unused part is refunded | ✅ |
| NEP-141 fungible tokens (USDC) | Clients pay with `ft_transfer_call` (invoice id in `msg`); the contract checks it in `ft_on_transfer` and pays each split with `ft_transfer`. A wrong payment panics, so USDC refunds the client automatically | ✅ |
| NEAR Connect wallet selector | Freelancers and clients sign in with any NEAR wallet (Meteor, HOT, Intear, Ledger, …) and sign transactions in the browser | ✅ |
| Cross-contract calls + callbacks | Each payout is followed by a callback; if a transfer fails (e.g. recipient not registered on USDC), the share is kept for them to `withdraw` instead of being lost | ✅ |
| NEAR Intents (1-Click API) | Clients pay with ETH, SOL, BTC or USDC on Base/Arbitrum/Solana, from any wallet, with no NEAR account. Settl requests an `EXACT_OUTPUT` quote for the invoice amount with `customRecipientMsg` = the invoice id, so solvers deliver USDC to the contract via `ft_transfer_call` and the normal `ft_on_transfer` marks it paid. Intents is mainnet-only, so on testnet the pay page shows live dry-run prices | 🟡 built; live payments need the mainnet deployment |
| Meta transactions | Gasless invoice creation for freelancers | planned |

## Try it
Requirements: Rust (the pinned toolchain in `contract/rust-toolchain.toml` installs automatically),
[`cargo-near`](https://github.com/near/cargo-near).

```bash
cd contract
cargo test --lib    # unit tests: expect "44 passed"
cargo test --test payment_flow   # end-to-end on a local NEAR sandbox: expect "4 passed"
cargo near build non-reproducible-wasm   # build target/near/settl.wasm
```

The end-to-end tests start a local NEAR chain (downloaded on first run), deploy Settl and a mock USDC
token, and check real balances after: a 70/30 split payment, a wrong-amount refund, escrow then
release, and a payout to an unregistered account that is withdrawn later.

### Web app
```bash
cd web
npm install
cp .env.example .env.local
npm run dev        # open http://localhost:3000
```
Do: open `/invoices/new`, connect a NEAR testnet wallet, create an invoice. See: a share page with the
payment link. Open the link (e.g. on a phone), pay with a wallet holding testnet USDC. See: the receipt
with each collaborator's share.

## Contract API
| Function | Type | Description |
|---|---|---|
| `new(usdc_contract)` | init | Sets which token is accepted as payment |
| `create_invoice(client_name, description, amount, due_date, splits, escrow)` | change, payable | Creates an invoice, returns its id. `amount` is in USDC base units (6 decimals: `"25000000"` = 25 USDC). `splits` is a list of `{account_id, basis_points}` adding up to 10,000 (100%), max 5. Attach ~0.01 NEAR for storage; the excess is refunded |
| `ft_on_transfer(sender_id, amount, msg)` | change | Called by the USDC contract when a client pays with `ft_transfer_call`. `msg` is the invoice id (`"12"`) or JSON `{"invoice_id": 12, "payer": "client.near"}`. The amount must match exactly; anything wrong is refunded. Non-escrow invoices are paid out to the splits immediately |
| `release_escrow(invoice_id)` | change | Payer only: pays out an escrowed invoice |
| `cancel_invoice(invoice_id)` | change | Creator only, while unpaid |
| `withdraw()` | change | Sends the caller any USDC from payouts that could not be delivered |
| `get_invoice(invoice_id)` | view | One invoice, or `null` |
| `get_invoices_by_creator(account_id, from_index?, limit?)` | view | A freelancer's invoices, newest first (default 50, max 100) |
| `get_usdc_contract()` | view | The accepted token |
| `get_pending_balance(account_id)` | view | USDC waiting for `withdraw` |

Invoice statuses: `Unpaid` → `Paid`, or `Unpaid` → `Escrowed` → `Paid`, or `Unpaid` → `Cancelled`.

## Repository layout
```
contract/   Rust smart contract (cargo-near project)
  src/lib.rs       contract state, create/cancel invoice, views
  src/invoice.rs   Invoice, Split, Status types
  src/payment.rs   ft_on_transfer, payouts, escrow release, withdraw
  src/tests/       unit tests
  tests/           end-to-end sandbox tests
  mock-usdc/       minimal NEP-141 token used only by the tests
web/        Next.js app (see web/README.md)
```

## Roadmap
1. ✅ Contract: create invoice, views, unit tests
2. ✅ Contract: pay via `ft_on_transfer`, payouts to splits, escrow release, cancel, end-to-end tests
3. ✅ Deploy to testnet
4. ✅ Web: create invoice → payment link → mobile pay page → receipt; freelancer dashboard
5. Pay with any token via NEAR Intents; gasless via meta transactions
6. Income proof page, overdue reminders

## Libraries and templates
- Contract scaffolded with `cargo near new` (official template), then rewritten for Settl.
- `near-contract-standards` for the NEP-141 interfaces; `near-sandbox` + `near-api` for end-to-end tests.
- Built with help from AI coding tools (Claude Code), as allowed by the hackathon rules (Q-005).

## License
[MIT](LICENSE)
