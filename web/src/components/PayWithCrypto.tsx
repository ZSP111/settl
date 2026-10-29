"use client";

/**
 * Pay an invoice with ETH, SOL, BTC or USDC on another chain, through NEAR Intents.
 * Flow: pick a token → enter your address (for refunds) → see the live price → get a one-time
 * deposit address → send from any wallet → we poll 1-Click until the USDC reaches Settl.
 */
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import { intentsLive } from "@/lib/config";
import {
  ADDRESS_HINTS,
  getSwapStatus,
  isValidAddress,
  PAYMENT_OPTIONS,
  type PaymentOption,
  type Quote,
  requestQuote,
  type SwapStatus,
  WRAP_NEAR,
} from "@/lib/intents";
import { type Invoice, payIntentsDepositWithNear } from "@/lib/settl";

import { Button, ErrorMessage } from "./ui";
import { useWallet } from "./WalletProvider";

const POLL_INTERVAL_MS = 5_000;

/** A deposit in progress, remembered per invoice so a page refresh doesn't lose it. */
interface PendingDeposit {
  optionId: string;
  quote: Quote;
}

function storageKey(invoiceId: number) {
  return `settl:deposit:${invoiceId}`;
}

function loadDeposit(invoiceId: number): PendingDeposit | null {
  try {
    const saved = localStorage.getItem(storageKey(invoiceId));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveDeposit(invoiceId: number, deposit: PendingDeposit | null) {
  try {
    if (deposit) localStorage.setItem(storageKey(invoiceId), JSON.stringify(deposit));
    else localStorage.removeItem(storageKey(invoiceId));
  } catch {
    // Storage unavailable (private mode): the deposit just won't survive a refresh.
  }
}

export function PayWithCrypto({ invoice, onPaid }: { invoice: Invoice; onPaid: () => void }) {
  const [deposit, setDeposit] = useState<PendingDeposit | null>(() =>
    typeof window === "undefined" ? null : loadDeposit(invoice.id),
  );

  if (invoice.escrow) {
    return (
      <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
        This invoice uses escrow, so it must be paid from a NEAR wallet: releasing the money later needs
        your NEAR account&apos;s approval.
      </p>
    );
  }

  if (deposit) {
    return (
      <DepositInstructions
        deposit={deposit}
        onDone={() => {
          saveDeposit(invoice.id, null);
          onPaid();
        }}
        onStartOver={() => {
          saveDeposit(invoice.id, null);
          setDeposit(null);
        }}
      />
    );
  }

  return (
    <QuoteForm
      invoice={invoice}
      onDeposit={(next) => {
        saveDeposit(invoice.id, next);
        setDeposit(next);
      }}
    />
  );
}

function QuoteForm({ invoice, onDeposit }: { invoice: Invoice; onDeposit: (deposit: PendingDeposit) => void }) {
  const { accountId } = useWallet();
  const [option, setOption] = useState<PaymentOption>(PAYMENT_OPTIONS[0]);
  const [address, setAddress] = useState("");
  const [preview, setPreview] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addressValid = isValidAddress(option.addressKind, address);

  // Fetch a free dry-run quote whenever the token or a valid address changes.
  useEffect(() => {
    if (!addressValid) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      requestQuote({ invoiceId: invoice.id, optionId: option.id, refundTo: address, dry: true })
        .then((quote) => !cancelled && (setPreview(quote), setError(null)))
        .catch((err) => !cancelled && (setPreview(null), setError(err.message)));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [invoice.id, option.id, address, addressValid]);

  async function getDepositAddress() {
    setLoading(true);
    setError(null);
    try {
      const quote = await requestQuote({ invoiceId: invoice.id, optionId: option.id, refundTo: address, dry: false });
      onDeposit({ optionId: option.id, quote });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              setOption(o);
              // Paying in NEAR: refunds go back to the connected NEAR account.
              if (o.addressKind === "near" && accountId) setAddress(accountId);
              setPreview(null);
            }}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
              o.id === option.id ? "border-accent bg-blue-50 text-accent" : "border-line hover:bg-surface"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Your address</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={ADDRESS_HINTS[option.addressKind]}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-line px-3 py-2.5 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <span className="block text-xs text-muted">If anything goes wrong, your funds are refunded here.</span>
      </label>

      {addressValid && preview && (
        <div className="rounded-xl bg-surface p-3 text-sm">
          <p>
            You send about{" "}
            <span className="font-display font-bold">
              {Number(preview.amountInFormatted).toPrecision(6)} {option.symbol}
            </span>{" "}
            <span className="text-muted">(${Number(preview.amountInUsd).toFixed(2)})</span>
          </p>
          <p className="text-muted">Arrives in about {formatDuration(preview.timeEstimate)}. Any unused amount is refunded.</p>
        </div>
      )}
      {address && !addressValid && <ErrorMessage>{ADDRESS_HINTS[option.addressKind]} is required.</ErrorMessage>}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {intentsLive ? (
        <Button onClick={getDepositAddress} disabled={!addressValid || !preview || loading} className="w-full">
          {loading ? "Getting address…" : `Pay with ${option.symbol}`}
        </Button>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
          Live prices from NEAR Intents. Payments with other crypto open on mainnet; on testnet, pay with USDC above.
        </p>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<SwapStatus, string> = {
  PENDING_DEPOSIT: "Waiting for your payment…",
  KNOWN_DEPOSIT_TX: "Payment seen, waiting for confirmations…",
  PROCESSING: "Converting to USDC…",
  SUCCESS: "Done! USDC delivered.",
  INCOMPLETE_DEPOSIT: "The amount received is too low. Send the rest, or wait for the automatic refund.",
  REFUNDED: "The swap didn't complete, so your funds were refunded.",
  FAILED: "Something went wrong with the swap. Your funds will be refunded.",
};

function DepositInstructions({
  deposit,
  onDone,
  onStartOver,
}: {
  deposit: PendingDeposit;
  onDone: () => void;
  onStartOver: () => void;
}) {
  const { quote } = deposit;
  const option = PAYMENT_OPTIONS.find((o) => o.id === deposit.optionId) ?? PAYMENT_OPTIONS[0];
  const depositAddress = quote.depositAddress ?? "";
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<SwapStatus>("PENDING_DEPOSIT");
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    QRCode.toDataURL(depositAddress, { margin: 1, width: 360 }).then(setQr).catch(() => setQr(null));
  }, [depositAddress]);

  // Ask 1-Click for progress every few seconds until the swap finishes.
  useEffect(() => {
    let stopped = false;
    async function poll() {
      const next = await getSwapStatus(depositAddress);
      if (stopped || !next) return;
      setStatus(next);
      if (next === "SUCCESS") onDoneRef.current();
    }
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [depositAddress]);

  const finished = status === "REFUNDED" || status === "FAILED";
  const { accountId, connect, signAndSend } = useWallet();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // For NEAR, the connected wallet can make the deposit directly (wrap NEAR → send wNEAR).
  async function sendWithNearWallet() {
    if (!accountId) return connect();
    setSending(true);
    setSendError(null);
    try {
      await signAndSend([payIntentsDepositWithNear(WRAP_NEAR, accountId, depositAddress, quote.amountIn)]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Send exactly <CopyValue value={quote.amountInFormatted} suffix={` ${option.symbol}`} /> on{" "}
        <span className="font-semibold">{option.label.replace(/^.* on /, "")}</span> to this address:
      </p>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not a remote image
        <img src={qr} alt="Deposit address QR code" className="mx-auto size-44 rounded-xl border border-line" />
      )}
      <CopyValue value={depositAddress} block />
      {option.addressKind === "near" && status === "PENDING_DEPOSIT" && (
        <>
          <Button onClick={sendWithNearWallet} disabled={sending} className="w-full">
            {sending ? "Confirm in your wallet…" : accountId ? `Send ${option.symbol} from ${accountId}` : "Connect NEAR wallet to send"}
          </Button>
          {sendError && <ErrorMessage>{sendError}</ErrorMessage>}
        </>
      )}
      {quote.depositMemo && (
        <p className="text-sm">
          Memo (required): <CopyValue value={quote.depositMemo} />
        </p>
      )}
      <div className="flex items-center gap-2 rounded-xl bg-surface p-3 text-sm">
        {!finished && status !== "SUCCESS" && <span className="size-2 animate-pulse rounded-full bg-accent" />}
        <span>{STATUS_TEXT[status]}</span>
      </div>
      {quote.deadline && !finished && (
        <p className="text-xs text-muted">
          This address is for this payment only. Send before{" "}
          {new Date(quote.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
        </p>
      )}
      <button onClick={onStartOver} className="text-sm font-semibold text-muted hover:text-ink">
        {finished ? "Try again" : "Pay a different way"}
      </button>
    </div>
  );
}

function CopyValue({ value, suffix = "", block = false }: { value: string; suffix?: string; block?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className={`rounded-lg bg-surface px-2 py-1 text-left font-mono text-sm font-semibold hover:bg-line ${
        block ? "block w-full break-all" : "inline"
      }`}
    >
      {value}
      {suffix}
      <span className="ml-2 font-sans text-xs text-accent">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

function formatDuration(seconds: number): string {
  return seconds < 90 ? `${seconds} seconds` : `${Math.round(seconds / 60)} minutes`;
}
