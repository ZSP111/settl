/** Small shared building blocks used across pages. */
import Link from "next/link";

import type { Status } from "@/lib/settl";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>{children}</div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent/90"
      : "border border-line bg-white text-ink hover:bg-surface";
  return (
    <button
      className={`inline-flex h-12 items-center justify-center rounded-xl px-5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-5 font-semibold text-white transition hover:bg-accent/90"
    >
      {children}
    </Link>
  );
}

const STATUS_STYLES: Record<Status, string> = {
  Unpaid: "bg-amber-50 text-amber-800",
  Escrowed: "bg-blue-50 text-accent",
  Paid: "bg-emerald-50 text-paid",
  Cancelled: "bg-gray-100 text-muted",
};

const STATUS_LABELS: Record<Status, string> = {
  Unpaid: "Unpaid",
  Escrowed: "In escrow",
  Paid: "Paid",
  Cancelled: "Cancelled",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{children}</p>;
}
