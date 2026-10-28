# Settl

Crypto invoices for freelancers, built at NEAR HACKATHON (Oct–Nov 2026).

A freelancer creates an invoice and gets a payment link. The client opens the link and pays in USDC,
and the freelancer receives USDC on NEAR. Payments can be split automatically between several accounts,
and can be held in escrow until the client approves the work.

> **Status: in development.** Done so far: the smart contract can create invoices (with payout splits)
> and list them. Payment, escrow, the web app and NEAR Intents are next. See [Roadmap](#roadmap).

## The problem
Freelancers paid in crypto chase clients for the "right" token and chain, pay bridge and exchange fees,
and split money with collaborators by hand. Settl gives them one link that settles in a stablecoin
and splits the payout on-chain.

## NEAR tech used
| Tech | What it does in Settl | Status |
|---|---|---|
| Rust smart contract (`near-sdk`) | Stores invoices, validates splits, will receive and pay out USDC | ✅ create + views |
| Storage staking | The freelancer attaches a small NEAR deposit to pay for their invoice's on-chain storage; the unused part is refunded | ✅ |
| NEP-141 fungible tokens (USDC) | Clients pay with `ft_transfer_call`; the contract receives it in `ft_on_transfer` | planned |
| NEAR Intents (1-Click API) | Clients pay with ETH/SOL/BTC; USDC arrives at the contract | planned |
| Meta transactions | Gasless invoice creation for freelancers | planned |

## Try it
Requirements: Rust (the pinned toolchain in `contract/rust-toolchain.toml` installs automatically),
[`cargo-near`](https://github.com/near/cargo-near).

```bash
cd contract
cargo test          # run the unit tests: expect "18 passed"
cargo near build non-reproducible-wasm   # build target/near/settl.wasm
```

## Contract API
| Function | Type | Description |
|---|---|---|
| `new(usdc_contract)` | init | Sets which token is accepted as payment |
| `create_invoice(client_name, description, amount, due_date, splits, escrow)` | change, payable | Creates an invoice, returns its id. `amount` is in USDC base units (6 decimals: `"25000000"` = 25 USDC). `splits` is a list of `{account_id, basis_points}` adding up to 10,000 (100%), max 5. Attach ~0.01 NEAR for storage; the excess is refunded |
| `get_invoice(invoice_id)` | view | One invoice, or `null` |
| `get_invoices_by_creator(account_id, from_index?, limit?)` | view | A freelancer's invoices, newest first (default 50, max 100) |
| `get_usdc_contract()` | view | The accepted token |

Invoice statuses: `Unpaid` → `Paid`, or `Unpaid` → `Escrowed` → `Paid`, or `Unpaid` → `Cancelled`.

## Repository layout
```
contract/   Rust smart contract (cargo-near project)
  src/lib.rs       contract state and public functions
  src/invoice.rs   Invoice, Split, Status types
  src/tests.rs     unit tests
web/        Next.js app (coming)
```

## Roadmap
1. ✅ Contract: create invoice, views, unit tests
2. Contract: pay via `ft_on_transfer`, payouts to splits, escrow release, cancel
3. Deploy to testnet
4. Web: create invoice → payment link → mobile pay page → receipt; freelancer dashboard
5. Pay with any token via NEAR Intents; gasless via meta transactions
6. Income proof page, overdue reminders

## Libraries and templates
- Contract scaffolded with `cargo near new` (official template), then rewritten for Settl.
- Built with help from AI coding tools (Claude Code), as allowed by the hackathon rules (Q-005).

## License
[MIT](LICENSE)
