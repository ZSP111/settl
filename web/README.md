# Settl web app

Next.js (App Router) + TypeScript + Tailwind. Talks to the Settl contract directly from the browser:
free view calls over NEAR JSON-RPC, and wallet-signed transactions through
[NEAR Connect](https://github.com/azbang/near-connect) (`@hot-labs/near-connect`).

```bash
npm install
cp .env.example .env.local   # contract ids, RPC, network
npm run dev                  # http://localhost:3000
```

| Route | Who | What |
|---|---|---|
| `/` | anyone | Landing page |
| `/invoices/new` | freelancer | Create an invoice: amount, due date, payout split, escrow |
| `/invoices/[id]` | freelancer | Share the payment link (copy, WhatsApp, email), follow status, cancel |
| `/dashboard` | freelancer | All invoices with paid / outstanding / escrow totals |
| `/pay/[id]` | client | Mobile-first pay page → wallet payment → receipt with split breakdown; escrow approval; pay with ETH/SOL/BTC via NEAR Intents |
| `/api/intents/quote`, `/api/intents/status` | server | Proxy to the 1-Click API. The quote route reads the invoice amount from the contract itself |

Code map: `src/lib/settl.ts` (contract types, views, transactions), `src/lib/near.ts` (RPC view calls),
`src/lib/usdc.ts` (USDC amounts as integers, never floats), `src/lib/intents.ts` + `src/components/PayWithCrypto.tsx` (NEAR Intents), `src/components/WalletProvider.tsx` (wallet).
