/**
 * "Pay with any crypto" via NEAR Intents' 1-Click API.
 *
 * The client sends ETH/SOL/BTC/… to a one-time deposit address. Market makers ("solvers") swap it,
 * and exactly the invoice amount of USDC is delivered to the Settl contract with `ft_transfer_call`,
 * carrying the invoice id in `msg` (1-Click's `customRecipientMsg`). The contract's normal
 * `ft_on_transfer` then marks the invoice paid and pays out the splits.
 *
 * The browser talks to our own API routes (src/app/api/intents/*), which call 1-Click.
 */

export type AddressKind = "evm" | "solana" | "bitcoin";

export interface PaymentOption {
  id: string;
  /** What the client sees, e.g. "ETH on Base". */
  label: string;
  symbol: string;
  /** 1-Click asset id of the token the client sends. */
  assetId: string;
  /** Which kind of address refunds go to. */
  addressKind: AddressKind;
}

/** A curated list of what clients most often hold. The full list is at GET /v0/tokens. */
export const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: "eth-base", label: "ETH on Base", symbol: "ETH", assetId: "nep141:base.omft.near", addressKind: "evm" },
  { id: "eth-arb", label: "ETH on Arbitrum", symbol: "ETH", assetId: "nep141:arb.omft.near", addressKind: "evm" },
  { id: "eth", label: "ETH on Ethereum", symbol: "ETH", assetId: "nep141:eth.omft.near", addressKind: "evm" },
  {
    id: "usdc-base",
    label: "USDC on Base",
    symbol: "USDC",
    assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    addressKind: "evm",
  },
  {
    id: "usdc-arb",
    label: "USDC on Arbitrum",
    symbol: "USDC",
    assetId: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
    addressKind: "evm",
  },
  {
    id: "usdc-sol",
    label: "USDC on Solana",
    symbol: "USDC",
    assetId: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
    addressKind: "solana",
  },
  { id: "sol", label: "SOL on Solana", symbol: "SOL", assetId: "nep141:sol.omft.near", addressKind: "solana" },
  { id: "btc", label: "Bitcoin", symbol: "BTC", assetId: "nep141:btc.omft.near", addressKind: "bitcoin" },
];

const ADDRESS_PATTERNS: Record<AddressKind, RegExp> = {
  evm: /^0x[0-9a-fA-F]{40}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  bitcoin: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
};

export const ADDRESS_HINTS: Record<AddressKind, string> = {
  evm: "0x… address of the wallet you pay from",
  solana: "Solana address of the wallet you pay from",
  bitcoin: "Bitcoin address (bc1…) for refunds",
};

export function isValidAddress(kind: AddressKind, address: string): boolean {
  return ADDRESS_PATTERNS[kind].test(address.trim());
}

/** The account NEAR Intents pays from. Shown as "via NEAR Intents" on receipts. */
export const INTENTS_CONTRACT = "intents.near";

// ---------- Talking to our API routes ----------

export interface Quote {
  /** Amount the client sends, in the token's smallest unit and formatted. */
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string;
  /** Seconds until the USDC should arrive after the deposit is confirmed. */
  timeEstimate: number;
  /** Only on a real (non-dry) quote: where the client sends funds, and until when. */
  depositAddress?: string;
  depositMemo?: string;
  deadline?: string;
}

export type SwapStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "PROCESSING"
  | "SUCCESS"
  | "INCOMPLETE_DEPOSIT"
  | "REFUNDED"
  | "FAILED";

export async function requestQuote(params: {
  invoiceId: number;
  optionId: string;
  refundTo: string;
  dry: boolean;
}): Promise<Quote> {
  const response = await fetch("/api/intents/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Could not get a quote");
  return json;
}

export async function getSwapStatus(depositAddress: string): Promise<SwapStatus | null> {
  const response = await fetch(`/api/intents/status?depositAddress=${encodeURIComponent(depositAddress)}`);
  if (!response.ok) return null;
  return (await response.json()).status;
}
