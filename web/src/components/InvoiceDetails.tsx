import { formatDate, formatPercent, shortAccount } from "@/lib/format";
import type { Invoice } from "@/lib/settl";
import { formatUsdc, splitAmount } from "@/lib/usdc";

import { Card, StatusPill } from "./ui";

/** The invoice as the client sees it: who, what, how much, when. */
export function InvoiceSummary({ invoice }: { invoice: Invoice }) {
  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Invoice #{invoice.id}</p>
          <p className="font-semibold">From {shortAccount(invoice.creator)}</p>
        </div>
        <StatusPill status={invoice.status} />
      </div>
      <div>
        <p className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {formatUsdc(invoice.amount)}
          <span className="ml-2 text-xl text-muted">USDC</span>
        </p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Row label="Billed to">{invoice.client_name}</Row>
        <Row label="Due">{formatDate(invoice.due_date)}</Row>
        <div className="sm:col-span-2">
          <Row label="For">
            <span className="whitespace-pre-line">{invoice.description}</span>
          </Row>
        </div>
      </dl>
      {invoice.escrow && invoice.status === "Unpaid" && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-accent">
          Escrow: your payment is held safely by the Settl contract and only released to the freelancer when you
          approve the work.
        </p>
      )}
    </Card>
  );
}

/** Who receives what. Shows final amounts, computed exactly like the contract. */
export function SplitBreakdown({ invoice }: { invoice: Invoice }) {
  const shares = splitAmount(
    invoice.amount,
    invoice.splits.map((split) => split.basis_points),
  );
  return (
    <ul className="divide-y divide-line">
      {invoice.splits.map((split, i) => (
        <li key={split.account_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span className="min-w-0 truncate">
            {shortAccount(split.account_id)}
            <span className="ml-2 text-muted">{formatPercent(split.basis_points)}</span>
          </span>
          <span className="font-display font-semibold">{formatUsdc(shares[i])} USDC</span>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
