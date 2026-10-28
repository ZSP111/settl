"use client";

import { use, useEffect, useState } from "react";

import { InvoiceSummary, SplitBreakdown } from "@/components/InvoiceDetails";
import { PayWithCrypto } from "@/components/PayWithCrypto";
import { Button, Card, ErrorMessage } from "@/components/ui";
import { useWallet } from "@/components/WalletProvider";
import { config } from "@/lib/config";
import { formatDate, shortAccount } from "@/lib/format";
import { INTENTS_CONTRACT } from "@/lib/intents";
import {
  getUsdcBalance,
  type Invoice,
  payInvoiceTransaction,
  releaseEscrowTransaction,
} from "@/lib/settl";
import { useInvoice } from "@/lib/useInvoice";
import { formatUsdc } from "@/lib/usdc";

/** The page a client opens from the payment link. Designed for phones first. */
export function PayView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { invoice, notFound, error, reload, loading } = useInvoice(Number(id));
  const [txHash, setTxHash] = useState<string | null>(null);

  // After any wallet transaction, even one the wallet reports as failed, re-read the invoice:
  // a payment can succeed while one payout inside it fails (that share is kept for `withdraw`).
  function onSettled(hash: string | null) {
    if (hash) setTxHash(hash);
    reload();
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      {loading && <p className="text-muted">Loading invoice…</p>}
      {notFound && <ErrorMessage>This invoice doesn&apos;t exist. Check the link you were sent.</ErrorMessage>}
      {error && <ErrorMessage>Could not load the invoice: {error}</ErrorMessage>}
      {invoice && (
        <>
          <InvoiceSummary invoice={invoice} />
          {invoice.status === "Unpaid" && (
            <>
              <PayCard invoice={invoice} onSettled={onSettled} />
              <Card className="space-y-4">
                <h2 className="font-display text-lg font-bold">Pay with ETH, SOL, BTC or other USDC</h2>
                <PayWithCrypto invoice={invoice} onPaid={() => onSettled(null)} />
              </Card>
            </>
          )}
          {invoice.status === "Escrowed" && <EscrowCard invoice={invoice} onSettled={onSettled} />}
          {invoice.status === "Paid" && <Receipt invoice={invoice} txHash={txHash} />}
          {invoice.status === "Cancelled" && (
            <Card>
              <p className="text-muted">This invoice was cancelled by the freelancer. No payment is needed.</p>
            </Card>
          )}
        </>
      )}
      <p className="pt-2 text-center text-xs text-muted">
        Secured by the Settl smart contract on NEAR {config.network === "testnet" && "testnet"}
      </p>
    </div>
  );
}

function PayCard({ invoice, onSettled }: { invoice: Invoice; onSettled: (txHash: string | null) => void }) {
  const { accountId, connect, signAndSend } = useWallet();
  const [balance, setBalance] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    getUsdcBalance(accountId).then(setBalance).catch(() => setBalance(null));
  }, [accountId]);

  const enoughBalance = balance !== null && BigInt(balance) >= BigInt(invoice.amount);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const [outcome] = await signAndSend([payInvoiceTransaction(invoice)]);
      onSettled(outcome.transaction.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      onSettled(null);
    } finally {
      setPaying(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-lg font-bold">Pay with USDC on NEAR</h2>
      {!accountId ? (
        <Button onClick={connect} className="w-full">
          Connect wallet to pay
        </Button>
      ) : (
        <>
          <p className="text-sm text-muted">
            Paying from <span className="font-semibold text-ink">{shortAccount(accountId)}</span>
            {balance !== null && <> · balance {formatUsdc(balance)} USDC</>}
          </p>
          {balance !== null && !enoughBalance && (
            <ErrorMessage>You need {formatUsdc(invoice.amount)} USDC in this account to pay.</ErrorMessage>
          )}
          <Button onClick={pay} disabled={paying || !enoughBalance} className="w-full">
            {paying ? "Confirm in your wallet…" : `Pay ${formatUsdc(invoice.amount)} USDC`}
          </Button>
        </>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Card>
  );
}

function EscrowCard({ invoice, onSettled }: { invoice: Invoice; onSettled: (txHash: string | null) => void }) {
  const { accountId, connect, signAndSend } = useWallet();
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPayer = accountId !== null && accountId === invoice.payer;

  async function release() {
    setReleasing(true);
    setError(null);
    try {
      const [outcome] = await signAndSend([releaseEscrowTransaction(invoice.id)]);
      onSettled(outcome.transaction.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      onSettled(null);
    } finally {
      setReleasing(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-lg font-bold">Payment held in escrow</h2>
      <p className="text-sm text-muted">
        {formatUsdc(invoice.amount)} USDC was paid on {formatDate(invoice.paid_at ?? "0")} and is held by the
        contract. It is released to the freelancer when the client approves.
      </p>
      {isPayer ? (
        <Button onClick={release} disabled={releasing} className="w-full">
          {releasing ? "Confirm in your wallet…" : "Approve work & release payment"}
        </Button>
      ) : !accountId ? (
        <Button variant="secondary" onClick={connect} className="w-full">
          Client? Connect wallet to approve
        </Button>
      ) : (
        <p className="text-sm">Waiting for {shortAccount(invoice.payer ?? "the client")} to approve.</p>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Card>
  );
}

function Receipt({ invoice, txHash }: { invoice: Invoice; txHash: string | null }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-paid text-lg text-white">✓</span>
        <div>
          <h2 className="font-display text-lg font-bold text-paid">Paid</h2>
          <p className="text-sm text-muted">
            {invoice.paid_at && formatDate(invoice.paid_at)}
            {invoice.payer &&
              (invoice.payer === INTENTS_CONTRACT ? <> · via NEAR Intents</> : <> · by {shortAccount(invoice.payer)}</>)}
          </p>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Paid out to</p>
        <SplitBreakdown invoice={invoice} />
      </div>
      {txHash && (
        <a
          href={`${config.explorerUrl}/txns/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-sm font-semibold text-accent"
        >
          View transaction on NearBlocks →
        </a>
      )}
    </Card>
  );
}
