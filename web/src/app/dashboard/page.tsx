"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RequireWallet } from "@/components/RequireWallet";
import { ButtonLink, Card, ErrorMessage, StatusPill } from "@/components/ui";
import { useWallet } from "@/components/WalletProvider";
import { formatDate } from "@/lib/format";
import { getInvoicesByCreator, type Invoice } from "@/lib/settl";
import { formatUsdc } from "@/lib/usdc";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">Invoices</h1>
        <ButtonLink href="/invoices/new">New invoice</ButtonLink>
      </div>
      <RequireWallet message="Connect your NEAR wallet to see your invoices.">
        <InvoiceList />
      </RequireWallet>
    </div>
  );
}

function InvoiceList() {
  const { accountId } = useWallet();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    getInvoicesByCreator(accountId)
      .then(setInvoices)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [accountId]);

  if (error) return <ErrorMessage>Could not load invoices: {error}</ErrorMessage>;
  if (!invoices) return <p className="text-muted">Loading…</p>;
  if (invoices.length === 0) {
    return (
      <Card>
        <p className="text-muted">No invoices yet. Create your first one and share the link with your client.</p>
      </Card>
    );
  }

  const total = (status: Invoice["status"]) =>
    invoices
      .filter((invoice) => invoice.status === status)
      .reduce((sum, invoice) => sum + BigInt(invoice.amount), BigInt(0))
      .toString();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Paid" value={total("Paid")} className="text-paid" />
        <Stat label="Outstanding" value={total("Unpaid")} />
        <Stat label="In escrow" value={total("Escrowed")} className="text-accent" />
      </div>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-line">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link href={`/invoices/${invoice.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{invoice.client_name}</p>
                  <p className="truncate text-sm text-muted">
                    #{invoice.id} · due {formatDate(invoice.due_date)}
                  </p>
                </div>
                <p className="font-display font-semibold">{formatUsdc(invoice.amount)}</p>
                <StatusPill status={invoice.status} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className={`font-display text-2xl font-bold ${className}`}>
        {formatUsdc(value)} <span className="text-sm text-muted">USDC</span>
      </p>
    </Card>
  );
}
