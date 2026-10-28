"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RequireWallet } from "@/components/RequireWallet";
import { Button, Card, ErrorMessage } from "@/components/ui";
import { useWallet } from "@/components/WalletProvider";
import { decodeSuccessValue } from "@/lib/near";
import { createInvoiceTransactions, type Split } from "@/lib/settl";
import { formatUsdc, parseUsdc, splitAmount } from "@/lib/usdc";

const MAX_SPLITS = 5;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/** One row of the split editor; `percent` is the text the user typed. */
interface SplitRow {
  accountId: string;
  percent: string;
}

/** "33.33" → 3333 basis points, or null if not a valid percentage with up to 2 decimals. */
function percentToBasisPoints(percent: string): number | null {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(percent.trim())) return null;
  const basisPoints = Math.round(Number(percent) * 100);
  return basisPoints > 0 && basisPoints <= 10_000 ? basisPoints : null;
}

export default function NewInvoicePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-bold">New invoice</h1>
      <RequireWallet message="Connect your NEAR wallet to create an invoice. Payments go to this account.">
        <InvoiceForm />
      </RequireWallet>
    </div>
  );
}

function InvoiceForm() {
  const router = useRouter();
  const { accountId, signAndSend } = useWallet();
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() =>
    new Date(Date.now() + TWO_WEEKS_MS).toISOString().slice(0, 10),
  );
  const [splits, setSplits] = useState<SplitRow[]>([{ accountId: accountId ?? "", percent: "100" }]);
  const [escrow, setEscrow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountBaseUnits = parseUsdc(amount);
  const basisPoints = splits.map((row) => percentToBasisPoints(row.percent));
  const totalBasisPoints = basisPoints.reduce<number>((sum, bp) => sum + (bp ?? 0), 0);
  const splitsValid =
    basisPoints.every((bp) => bp !== null) &&
    splits.every((row) => row.accountId.trim() !== "") &&
    totalBasisPoints === 10_000;
  const previewShares =
    amountBaseUnits && splitsValid ? splitAmount(amountBaseUnits, basisPoints as number[]) : null;

  function updateSplit(index: number, change: Partial<SplitRow>) {
    setSplits((rows) => rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!amountBaseUnits || !splitsValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const contractSplits: Split[] = splits.map((row, i) => ({
        account_id: row.accountId.trim().toLowerCase(),
        basis_points: basisPoints[i] as number,
      }));
      const transactions = await createInvoiceTransactions({
        clientName: clientName.trim(),
        description: description.trim(),
        amount: amountBaseUnits,
        dueDate: new Date(`${dueDate}T23:59:59`).getTime(),
        splits: contractSplits,
        escrow,
      });
      const outcomes = await signAndSend(transactions);
      // The last transaction is create_invoice; its return value is the new invoice id.
      const status = outcomes[outcomes.length - 1]?.status;
      if (typeof status !== "object" || !status.SuccessValue) {
        throw new Error("The invoice could not be created.");
      }
      const invoiceId = decodeSuccessValue<number>(status.SuccessValue);
      router.push(`/invoices/${invoiceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="space-y-4">
        <Field label="Client">
          <input
            required
            maxLength={100}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Ltd"
            className={INPUT}
          />
        </Field>
        <Field label="What is it for?">
          <textarea
            required
            maxLength={1000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Logo design, 3 concepts + final files"
            className={INPUT}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (USDC)">
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="250.00"
              className={`${INPUT} font-display`}
            />
            {amount && !amountBaseUnits && (
              <span className="text-xs text-red-700">Enter an amount like 250 or 99.50</span>
            )}
          </Field>
          <Field label="Due date">
            <input
              required
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold">Payout split</h2>
          <p className="text-sm text-muted">Who receives the payment. Shares must add up to 100%.</p>
        </div>
        {splits.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              aria-label="NEAR account"
              value={row.accountId}
              onChange={(e) => updateSplit(index, { accountId: e.target.value })}
              placeholder="collaborator.testnet"
              className={`${INPUT} flex-1`}
            />
            <div className="relative w-24">
              <input
                aria-label="Share in percent"
                inputMode="decimal"
                value={row.percent}
                onChange={(e) => updateSplit(index, { percent: e.target.value })}
                className={`${INPUT} pr-7 text-right`}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted">%</span>
            </div>
            {splits.length > 1 && (
              <button
                type="button"
                onClick={() => setSplits((rows) => rows.filter((_, i) => i !== index))}
                aria-label="Remove"
                className="px-2 text-muted hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between text-sm">
          {splits.length < MAX_SPLITS ? (
            <button
              type="button"
              onClick={() => setSplits((rows) => [...rows, { accountId: "", percent: "" }])}
              className="font-semibold text-accent"
            >
              + Add collaborator
            </button>
          ) : (
            <span />
          )}
          <span className={totalBasisPoints === 10_000 ? "text-paid" : "text-red-700"}>
            Total {totalBasisPoints / 100}%
          </span>
        </div>
        {previewShares && splits.length > 1 && (
          <ul className="space-y-1 rounded-xl bg-surface p-3 text-sm">
            {splits.map((row, i) => (
              <li key={i} className="flex justify-between">
                <span>{row.accountId}</span>
                <span className="font-display">{formatUsdc(previewShares[i])} USDC</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <label className="flex cursor-pointer gap-3">
          <input
            type="checkbox"
            checked={escrow}
            onChange={(e) => setEscrow(e.target.checked)}
            className="mt-1 size-4 accent-accent"
          />
          <span>
            <span className="font-semibold">Hold payment in escrow</span>
            <span className="block text-sm text-muted">
              The client pays up front, and the money is released to you when they approve the work.
            </span>
          </span>
        </label>
      </Card>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Button type="submit" disabled={submitting || !amountBaseUnits || !splitsValid} className="w-full">
        {submitting ? "Confirm in your wallet…" : "Create invoice"}
      </Button>
      <p className="text-center text-xs text-muted">
        Creating an invoice costs a tiny NEAR deposit for on-chain storage; the unused part is refunded.
      </p>
    </form>
  );
}

const INPUT =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
