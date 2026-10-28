# Settl — crypto invoices for freelancers (NEAR Hackathon)

## What we're building
A freelancer creates an invoice and gets a payment link. The client opens the link,
pays with whatever crypto they hold (USDC, ETH, SOL, BTC), and the freelancer receives
USDC on NEAR instantly. Payments can auto-split between several accounts and can be held
in escrow until the client approves the work.

Working name: **Settl** (may change).

## Hackathon rules that matter
- NEAR Hackathon. Hackathon starts **1 Nov 2026 00:00 UTC**; development ends **14 Nov 2026 23:59 UTC**.
- Code may be written from the announcement on **19 Oct 2026** (HACKATHON.md, Q-001). Do not import code from older projects.
- NEAR Intents has no testnet (Q-007): the "pay with any token" demo runs on mainnet with tiny amounts; develop with `dry: true` quotes.
- Repo must be **public**. Submission = public repo link + demo post on X (video or screenshots).
- Tracks we're entering: **Real-World Money** (main), plus **Unstoppable DeFi** / **Open Innovation** if the Intents work is strong.
- Judges include Claude Code & Codex as AI judges: keep the repo clean, readable and well documented.
- See `HACKATHON.md` in the repo root (official file from nearhackathon.com) for the full rules.

## The owner
Billonaire is a web developer who is new to NEAR and smart contracts.
- Explain every new blockchain concept in plain English before or while using it.
- After finishing each feature, summarize what was built, how to test it, and what's next.
- Prefer simple, readable code over clever code.
- Make reasonable decisions without asking; ask only when a choice is hard to undo.

## Tech stack
- **Smart contract:** Rust + `near-sdk`, in `/contract`. Deploy to **testnet** first.
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind, in `/web`.
- **Wallets:** NEAR wallet connection for freelancers; client pay page should also accept EVM/Solana wallets via NEAR Intents.
- **Stablecoin:** USDC on NEAR (a NEP-141 fungible token). Use the testnet USDC contract or a mock NEP-141 token for local testing.
- Check current NEAR docs (docs.near.org) for the recommended packages before installing; NEAR tooling changes often.

## NEAR toolkit (starting points, not a checklist)
Before using any of these, check the current docs for endpoints, contract addresses and SDK versions.
`HACKATHON.md` also links docs from ten ecosystem partners.
- NEAR Intents: https://docs.near-intents.org/index — "pay with any token"
- 1-Click Swap SDK: https://docs.near.org/getting-started/hackathons#near-protocol-sdks — likely the easiest way into Intents
- Meta transactions: https://docs.near.org/protocol/transactions/meta-tx#meta-transactions — gasless for freelancers
- Function call keys: https://docs.near.org/protocol/accounts-contracts/access-keys#function-call-keys — e.g. a relayer key limited to our contract
- Named accounts: https://docs.near.org/tools/near-api#create-named-account — `you.near` instead of hex addresses
- Sub-accounts: https://docs.near.org/tools/near-api#create-sub-account
- Chain Signatures: https://docs.near.org/getting-started/hackathons#chain-signatures
- Chain abstraction: https://docs.near.org/chain-abstraction/what-is
- NEAR AI Cloud / TEEs: https://docs.near.ai/ (not planned for Settl)

**README rule:** the README must have a "NEAR tech used" section naming every one of these we actually used and what it does in Settl. Keep it updated as features land.

## Contract design (first draft — refine as needed)
Data: `Invoice { id, creator, client_name, description, amount (USDC base units), due_date, splits: Vec<(AccountId, basis_points)>, escrow: bool, status: Unpaid | Escrowed | Paid | Cancelled, payer, paid_at }`

Functions:
- `create_invoice(...)` → returns invoice id. Splits must add up to 10,000 basis points.
- `ft_on_transfer(sender_id, amount, msg)` — called when USDC is sent with `ft_transfer_call`. `msg` carries the invoice id. Check the token is USDC and the amount matches. If escrow: mark Escrowed and hold. Otherwise pay out the splits and mark Paid.
- `release_escrow(invoice_id)` — only the payer can call; pays out splits.
- `cancel_invoice(invoice_id)` — only the creator, only while Unpaid.
- Views: `get_invoice(id)`, `get_invoices_by_creator(account_id)`.

Known gotcha: an account must be registered on the USDC contract (storage deposit) before it can receive tokens. Handle this for every split recipient.

## Build order (do not skip ahead until the current tier works end to end)
**Tier 1 — core (Days 1–5)**
1. Contract: create, pay via `ft_on_transfer`, views. Unit tests.
2. Deploy to testnet.
3. Web: create-invoice page → shareable link `/pay/[id]` → pay page → paid receipt.
4. Freelancer dashboard listing invoices and statuses.

**Tier 2 — standouts (Days 6–10)**
5. Pay with any token via NEAR Intents (docs.near-intents.org). Research how to deliver USDC to the contract with the invoice id attached; if not directly possible, use a relayer account that receives the swap output and calls `ft_transfer_call`.
6. Auto-split payouts in the UI.
7. Escrow flow in the UI (client approves → release).
8. Gasless for freelancers via NEAR meta transactions + a relayer.

**Tier 3 — polish (Days 11–12)**
9. Income proof page: shareable, verifiable history of paid invoices.
10. Overdue reminders, recurring invoices.

**Days 13–14:** README with screenshots + architecture diagram, demo video, X post, submission.

## Design
Screens are mocked up on the Settl canvas (dashboard, create invoice, pay page on mobile,
paid receipt with split). Fonts: Space Grotesk (headings, numbers) + Manrope (body).
Colors: ink #0E1116, background #F4F5F7, accent blue #2448E0, paid green #0B6B48.
The pay page must work well on a phone — clients will open links from WhatsApp and email.

## Conventions
- Small commits with clear messages.
- Never commit private keys, seed phrases or `.env` files. Use `.env.example`.
- Every contract function gets a unit test.
