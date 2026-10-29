/**
 * Income summary for the proof page: what a freelancer actually received from paid invoices.
 * Only their own share counts. Collaborators' splits are not their income.
 */
import type { Invoice } from "./settl";
import { splitAmount } from "./usdc";

export interface IncomeEntry {
  invoice: Invoice;
  /** The freelancer's own share, in USDC base units. */
  received: string;
}

export interface MonthTotal {
  /** "2026-11" */
  month: string;
  total: string;
  count: number;
}

export interface IncomeSummary {
  entries: IncomeEntry[];
  total: string;
  months: MonthTotal[];
  firstPaidAt: string | null;
  lastPaidAt: string | null;
}

/** The share of `invoice` that went to `accountId`, computed exactly like the contract's payout. */
export function shareFor(invoice: Invoice, accountId: string): string {
  const shares = splitAmount(
    invoice.amount,
    invoice.splits.map((split) => split.basis_points),
  );
  const index = invoice.splits.findIndex((split) => split.account_id === accountId);
  return index === -1 ? "0" : shares[index];
}

export function summarizeIncome(invoices: Invoice[], accountId: string): IncomeSummary {
  const entries = invoices
    .filter((invoice) => invoice.status === "Paid" && invoice.paid_at)
    .map((invoice) => ({ invoice, received: shareFor(invoice, accountId) }))
    .sort((a, b) => Number(b.invoice.paid_at) - Number(a.invoice.paid_at));

  const byMonth = new Map<string, { total: bigint; count: number }>();
  for (const { invoice, received } of entries) {
    const month = new Date(Number(invoice.paid_at)).toISOString().slice(0, 7);
    const current = byMonth.get(month) ?? { total: BigInt(0), count: 0 };
    byMonth.set(month, { total: current.total + BigInt(received), count: current.count + 1 });
  }

  return {
    entries,
    total: entries.reduce((sum, entry) => sum + BigInt(entry.received), BigInt(0)).toString(),
    months: [...byMonth.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, { total, count }]) => ({ month, total: total.toString(), count })),
    firstPaidAt: entries.at(-1)?.invoice.paid_at ?? null,
    lastPaidAt: entries[0]?.invoice.paid_at ?? null,
  };
}
