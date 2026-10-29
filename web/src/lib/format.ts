/** Display helpers. */

/** "1800000000000" (Unix ms) → "15 Jan 2027". */
export function formatDate(unixMs: string | number): string {
  return new Date(Number(unixMs)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Shortens hex account ids ("3e2210e1…b8af", "0x742d35…f44e"). Named accounts are never shortened. */
export function shortAccount(accountId: string): string {
  const isHex = /^[0-9a-f]{64}$/.test(accountId) || /^0x[0-9a-f]{40}$/.test(accountId);
  return isHex ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : accountId;
}

/** 7000 → "70%", 3333 → "33.33%". */
export function formatPercent(basisPoints: number): string {
  return `${basisPoints / 100}%`;
}
