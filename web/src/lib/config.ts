/**
 * App configuration, read from NEXT_PUBLIC_* environment variables (see .env.example).
 * Defaults point at NEAR testnet.
 */
export type NearNetwork = "testnet" | "mainnet";

export const config = {
  network: (process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "testnet") as NearNetwork,
  rpcUrl: process.env.NEXT_PUBLIC_NEAR_RPC_URL ?? "https://rpc.testnet.near.org",
  /** The Settl smart contract. */
  settlContract: process.env.NEXT_PUBLIC_SETTL_CONTRACT_ID ?? "settl-billonaire.testnet",
  /** USDC (a NEP-141 token). Default: Circle's USDC on testnet. */
  usdcContract:
    process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ??
    "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://testnet.nearblocks.io",
};

/**
 * NEAR Intents only exists on mainnet (HACKATHON.md, Q-007). On testnet the "pay with any crypto"
 * picker still shows live prices from dry-run quotes, but cannot create a deposit address.
 */
export const intentsLive = config.network === "mainnet";
