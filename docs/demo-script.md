# Settl demo video script (about 2 minutes)

The hackathon requires an X post with a **video** (HACKATHON.md, Q-012). This is a scene-by-scene plan:
what to show, what to tap, and what to say. Times are targets; stay under 2:30.

## Before recording
- **Phone**, screen recording on (iPhone: Control Centre → Screen Recording; Android: Quick Settings → Screen record).
- Testnet wallet `billonaire.testnet` in Meteor with some testnet USDC (faucet.circle.com).
- Mainnet wallet `bluecheese8363.near` with ~0.3 NEAR, for the live Intents payment in scene 5 (≈ $1).
- A second testnet account to receive a split, e.g. `billonaire-collab.testnet`.
- Close other apps and notifications (Do Not Disturb). Use a clean browser tab.
- Record each scene separately; join them in any editor (CapCut, iMovie). Speed up waiting (2–4×).

## Scenes

### 1. The problem (0:00–0:12)
**Show:** the Settl home page (testnet site).
**Say:** "Freelancers paid in crypto have to tell clients which token and chain to use, wait for bridges,
then split the money with collaborators by hand. Settl turns all of that into one link."

### 2. Create an invoice, for free (0:12–0:40)
**Show:** `/invoices/new` on the testnet site, connected as `billonaire.testnet`.
**Do:** Client "Acme Ltd", For "Logo design", Amount `2`. Payout split: change yourself to `70`,
**+ Add collaborator** `billonaire-collab.testnet` at `30`. Point at the preview (1.40 / 0.60 USDC)
and at the line **"Free: Settl pays the network fee and storage"**. Tap **Create invoice**; Meteor only asks to sign.
**Say:** "I set the amount in USDC and who gets what. Creating it is free: my wallet just signs, and
Settl's relayer pays the network fee. That's a NEAR meta transaction."

### 3. Share the link (0:40–0:50)
**Show:** the "Send this link to your client" page.
**Do:** tap **Share on WhatsApp** (show the share sheet, then cancel), or **Copy**.
**Say:** "I send the link over WhatsApp or email."

### 4. The client pays, the money splits itself (0:50–1:15)
**Show:** open the `/pay/…` link (ideally on a second phone or a fresh browser = "the client").
**Do:** **Connect wallet to pay** → **Pay 2.00 USDC** → approve. Wait for the green **Paid** receipt.
Zoom on **"Paid out to: 1.40 USDC / 0.60 USDC"**.
**Say:** "The client opens it on their phone and pays. The smart contract checks the amount and pays
each collaborator their share in the same transaction. No spreadsheets, no manual transfers."

### 5. Pay with any crypto: NEAR Intents (1:15–1:45)
**Show:** the **mainnet** site, a new $1 invoice's pay page.
**Do:** scroll to **"Pay with ETH, SOL, BTC or other USDC"**, tap through **ETH on Base**, **Bitcoin**, **SOL**
(paste any address so the live price appears), then pick **NEAR** and pay for real:
**Pay with NEAR** → **Send NEAR from …** → approve. Show *Converting to USDC…* (speed up), then
**Paid · via NEAR Intents**.
**Say:** "Clients don't need USDC, or even a NEAR account. They can pay with ETH, Solana or Bitcoin
from any wallet. NEAR Intents swaps it, and exactly the invoice amount in USDC lands in the contract,
tagged with this invoice. This is real money on mainnet."

### 6. Proof of income (1:45–1:55)
**Show:** `/proof/billonaire.testnet` (or your mainnet account).
**Say:** "Every paid invoice adds up to a public income proof, read live from the blockchain, that I
can send to a landlord or a bank."

### 7. Close (1:55–2:05)
**Show:** the GitHub repo README (diagram + "NEAR tech used").
**Say:** "Settl: invoices that settle themselves. Built on NEAR with Intents, meta transactions and a
Rust smart contract. Code and live demo in the post."

## Optional extras (if time allows)
- **Escrow:** create an invoice with "Hold payment in escrow", pay it, show **In escrow**, then
  **Approve work & release payment** → Paid. (~15 s)
- **Dashboard:** the totals row (Paid / Outstanding / In escrow). (~5 s)

## Checklist after recording
- Video ≤ 2:30, captions on (many people watch muted), no seed phrases or private keys on screen.
- Upload to X with the post below, then give the post link for the submission.
