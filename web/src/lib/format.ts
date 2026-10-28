/** Display helpers. */

/** "1800000000000" (Unix ms) → "15 Jan 2027". */
export function formatDate(unixMs: string | number): string {
  return new Date(Number(unixMs)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Shortens long implicit (hex) account ids: "3e2210e1…b8af". Named accounts stay as they are. */
export function shortAccount(accountId: string): string {
  return accountId.length > 24 ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : accountId;
}

/** 7000 → "70%", 3333 → "33.33%". */
export function formatPercent(basisPoints: number): string {
  return `${basisPoints / 100}%`;
}
