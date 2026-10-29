"use client";

/**
 * A shareable, verifiable income history: every paid invoice a freelancer created on Settl.
 * Nothing is stored by this site. It is read live from the Settl contract on NEAR, so anyone
 * can check the same numbers on-chain.
 */
import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Card, ErrorMessage } from "@/components/ui";
import { config } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { type IncomeSummary, summarizeIncome } from "@/lib/income";
import { getAllInvoicesByCreator } from "@/lib/settl";
import { useOrigin } from "@/lib/useOrigin";
import { formatUsdc } from "@/lib/usdc";

type LoadState = { kind: "loading" } | { kind: "loaded"; summary: IncomeSummary } | { kind: "error"; message: string };

export function ProofView({ params }: { params: Promise<{ account: string }> }) {
  const accountId = decodeURIComponent(use(params).account).toLowerCase();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const proofLink = `${useOrigin()}/proof/${accountId}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAllInvoicesByCreator(accountId)
      .then((invoices) => !cancelled && setState({ kind: "loaded", summary: summarizeIncome(invoices, accountId) }))
      .catch((err) => !cancelled && setState({ kind: "error", message: err instanceof Error ? err.message : String(err) }));
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  async function copyLink() {
    await navigator.clipboard.writeText(proofLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-accent">Income proof</p>
          <h1 className="font-display text-3xl font-bold break-all">{accountId}</h1>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={copyLink} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-surface">
            {copied ? "Copied" : "Copy link"}
          </button>
          <button onClick={() => window.print()} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-surface">
            Save as PDF
          </button>
        </div>
      </div>

      {state.kind === "loading" && <p className="text-muted">Reading payments from the blockchain…</p>}
      {state.kind === "error" && <ErrorMessage>Could not load the income history: {state.message}</ErrorMessage>}
      {state.kind === "loaded" && <Summary accountId={accountId} summary={state.summary} />}

      <Card className="space-y-2 text-sm text-muted">
        <h2 className="font-display text-base font-bold text-ink">How to verify this</h2>
        <p>
          This page stores nothing. Every number is read live from the Settl smart contract{" "}
          <a href={`${config.explorerUrl}/address/${config.settlContract}`} target="_blank" rel="noreferrer" className="font-semibold text-accent">
            {config.settlContract}
          </a>{" "}
          on NEAR {config.network}, which records each invoice, who paid it and when, and pays out USDC
          automatically. Anyone can call its <code className="text-ink">get_invoices_by_creator</code> view function
          to see the same data.
        </p>
        <p>Only paid invoices are listed. Amounts are this account&apos;s own share; splits paid to collaborators are excluded.</p>
      </Card>
    </div>
  );
}

function Summary({ accountId, summary }: { accountId: string; summary: IncomeSummary }) {
  if (summary.entries.length === 0) {
    return (
      <Card>
        <p className="text-muted">No paid invoices yet for {accountId}.</p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Total received</p>
          <p className="font-display text-2xl font-bold text-paid">
            {formatUsdc(summary.total)} <span className="text-sm text-muted">USDC</span>
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Paid invoices</p>
          <p className="font-display text-2xl font-bold">{summary.entries.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Period</p>
          <p className="font-display text-lg font-bold">{formatPeriod(summary.firstPaidAt, summary.lastPaidAt)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-display text-lg font-bold">By month</h2>
        <ul className="divide-y divide-line text-sm">
          {summary.months.map((month) => (
            <li key={month.month} className="flex justify-between py-2">
              <span>
                {new Date(`${month.month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}
                <span className="ml-2 text-muted">{month.count} {month.count === 1 ? "invoice" : "invoices"}</span>
              </span>
              <span className="font-display font-semibold">{formatUsdc(month.total)} USDC</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card padded={false}>
        <h2 className="px-5 pt-5 font-display text-lg font-bold sm:px-6">Payments</h2>
        <ul className="divide-y divide-line">
          {summary.entries.map(({ invoice, received }) => (
            <li key={invoice.id}>
              <Link href={`/pay/${invoice.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{invoice.client_name}</p>
                  <p className="truncate text-sm text-muted">
                    #{invoice.id} · paid {formatDate(invoice.paid_at ?? "0")}
                  </p>
                </div>
                <p className="font-display font-semibold">{formatUsdc(received)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/** "28 Oct 2026", or "3 Oct 2026 – 28 Oct 2026" when payments span more than one day. */
function formatPeriod(first: string | null, last: string | null): string {
  if (!first || !last) return "";
  const [from, to] = [formatDate(first), formatDate(last)];
  return from === to ? from : `${from} – ${to}`;
}
