"use client";

/**
 * Wallet connection via NEAR Connect (@hot-labs/near-connect). It shows a picker with
 * NEAR wallets (HOT, Meteor, Intear, …), remembers the choice, and signs transactions.
 * The library touches `window`, so it is only loaded in the browser.
 */
import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { config } from "@/lib/config";
import type { Transaction } from "@/lib/settl";

interface WalletContextValue {
  /** The signed-in NEAR account, or null. */
  accountId: string | null;
  /** True until we know whether a wallet was already connected. */
  loading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /** Signs and sends transactions in order; returns each one's outcome. */
  signAndSend: (transactions: Transaction[]) => Promise<TransactionOutcome[]>;
  /** Whether the connected wallet can sign meta transactions (needed for gasless). */
  supportsGasless: () => Promise<boolean>;
  /** Signs a transaction as a delegate action, without sending it; returns it base64-encoded. */
  signDelegate: (transaction: Transaction) => Promise<string>;
}

/** The part of a NEAR transaction outcome the app reads. */
export interface TransactionOutcome {
  transaction: { hash: string };
  status: { SuccessValue?: string; Failure?: unknown } | string;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connector, setConnector] = useState<NearConnector | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    import("@hot-labs/near-connect").then(async ({ NearConnector }) => {
      if (cancelled) return;
      const nearConnector = new NearConnector({ network: config.network });
      nearConnector.on("wallet:signIn", (event) => setAccountId(event.accounts[0]?.accountId ?? null));
      nearConnector.on("wallet:signOut", () => setAccountId(null));
      setConnector(nearConnector);
      try {
        const { accounts } = await nearConnector.getConnectedWallet();
        if (!cancelled) setAccountId(accounts[0]?.accountId ?? null);
      } catch {
        // No wallet connected yet.
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    if (!connector) return;
    const wallet = await connector.connect();
    const accounts = await wallet.getAccounts();
    setAccountId(accounts[0]?.accountId ?? null);
  }, [connector]);

  const disconnect = useCallback(async () => {
    if (!connector) return;
    await connector.disconnect();
    setAccountId(null);
  }, [connector]);

  const signAndSend = useCallback(
    async (transactions: Transaction[]) => {
      if (!connector) throw new Error("Wallet is still loading");
      const wallet: NearWalletBase = await connector.wallet();
      const outcomes = await wallet.signAndSendTransactions({ transactions });
      return outcomes as unknown as TransactionOutcome[];
    },
    [connector],
  );

  const supportsGasless = useCallback(async () => {
    if (!connector) return false;
    const wallet = await connector.wallet();
    return Boolean(wallet.manifest.features?.signDelegateActions);
  }, [connector]);

  const signDelegate = useCallback(
    async (transaction: Transaction) => {
      if (!connector) throw new Error("Wallet is still loading");
      const wallet = await connector.wallet();
      const { signedDelegateActions } = await wallet.signDelegateActions({ delegateActions: [transaction] });
      return signedDelegateActions[0];
    },
    [connector],
  );

  return (
    <WalletContext.Provider
      value={{ accountId, loading, connect, disconnect, signAndSend, supportsGasless, signDelegate }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside <WalletProvider>");
  return value;
}
