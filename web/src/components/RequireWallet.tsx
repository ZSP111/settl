"use client";

import { Button, Card } from "./ui";
import { useWallet } from "./WalletProvider";

/** Shows `children` only when a wallet is connected; otherwise asks to connect. */
export function RequireWallet({ children, message }: { children: React.ReactNode; message: string }) {
  const { accountId, loading, connect } = useWallet();
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!accountId) {
    return (
      <Card className="max-w-md space-y-4">
        <p>{message}</p>
        <Button onClick={connect}>Connect NEAR wallet</Button>
      </Card>
    );
  }
  return children;
}
