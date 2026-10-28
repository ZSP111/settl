"use client";

import Link from "next/link";
import { use, useState } from "react";

import { InvoiceSummary, SplitBreakdown } from "@/components/InvoiceDetails";
import { Button, Card, ErrorMessage } from "@/components/ui";
import { useWallet } from "@/components/WalletProvider";
import { cancelInvoiceTransaction } from "@/lib/settl";
import { useInvoice } from "@/lib/useInvoice";
import { useOrigin } from "@/lib/useOrigin";
import { formatUsdc } from "@/lib/usdc";

/** The freelancer's view of one invoice: share the payment link, follow its status. */
export function InvoiceView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { invoice, notFound, error, reload, loading } = useInvoice(Number(id));
  const { accountId, signAndSend } = useWallet();
  const payLink = `${useOrigin()}/pay/${id}`;
  const [copied, setCopied] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function copyLink() {
    await navigator.clipboard.writeText(payLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function cancel() {
    if (!confirm("Cancel this invoice? The payment link will stop working.")) return;
    setCancelError(null);
    try {
      await signAndSend([cancelInvoiceTransaction(Number(id))]);
      reload();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) return <p className="text-muted">Loading invoice…</p>;
  if (notFound) return <ErrorMessage>Invoice not found.</ErrorMessage>;
  if (error || !invoice) return <ErrorMessage>Could not load the invoice: {error}</ErrorMessage>;

  const shareText = `Invoice from ${invoice.creator}: ${formatUsdc(invoice.amount)} USDC. Pay here: ${payLink}`;
  const isCreator = accountId === invoice.creator;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/dashboard" className="text-sm font-semibold text-muted hover:text-ink">
        ← All invoices
      </Link>

      {invoice.status === "Unpaid" && (
        <Card className="space-y-3">
          <h2 className="font-display text-lg font-bold">Send this link to your client</h2>
          <div className="flex gap-2">
            <input readOnly value={payLink} className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm" />
            <Button onClick={copyLink} className="shrink-0">
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex gap-4 text-sm font-semibold">
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="text-accent">
              Share on WhatsApp
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(`Invoice #${invoice.id}`)}&body=${encodeURIComponent(shareText)}`} className="text-accent">
              Send by email
            </a>
          </div>
        </Card>
      )}

      <InvoiceSummary invoice={invoice} />

      <Card>
        <h2 className="mb-1 font-display text-lg font-bold">Payout split</h2>
        <SplitBreakdown invoice={invoice} />
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href={`/pay/${invoice.id}`} className="text-sm font-semibold text-accent">
          Open the client&apos;s payment page →
        </Link>
        {isCreator && invoice.status === "Unpaid" && (
          <button onClick={cancel} className="ml-auto text-sm font-semibold text-red-700">
            Cancel invoice
          </button>
        )}
      </div>
      {cancelError && <ErrorMessage>{cancelError}</ErrorMessage>}
    </div>
  );
}
