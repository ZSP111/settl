"use client";

import Link from "next/link";

import { shortAccount } from "@/lib/format";
import { useWallet } from "./WalletProvider";

export function Header() {
  const { accountId, loading, connect, disconnect } = useWallet();

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          Settl
        </Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          {accountId && (
            <Link href="/dashboard" className="hidden text-muted hover:text-ink sm:block">
              Dashboard
            </Link>
          )}
          {loading ? null : accountId ? (
            <button
              onClick={disconnect}
              title="Disconnect wallet"
              className="rounded-lg border border-line px-3 py-2 hover:bg-surface"
            >
              {shortAccount(accountId)}
            </button>
          ) : (
            <button onClick={connect} className="rounded-lg bg-ink px-3 py-2 text-white hover:bg-ink/90">
              Connect wallet
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
