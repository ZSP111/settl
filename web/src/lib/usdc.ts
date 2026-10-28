/**
 * USDC amounts. On-chain, USDC is an integer count of "base units" with 6 decimals:
 * 25.00 USDC is "25000000". We never use floating point for money.
 */
export const USDC_DECIMALS = 6;

/** "25000000" → "25.00" (at least 2 decimals, trailing zeros trimmed beyond that). */
export function formatUsdc(baseUnits: string): string {
  const padded = baseUnits.padStart(USDC_DECIMALS + 1, "0");
  const whole = padded.slice(0, -USDC_DECIMALS);
  const fraction = padded.slice(-USDC_DECIMALS).replace(/0+$/, "").padEnd(2, "0");
  return `${BigInt(whole).toLocaleString("en-US")}.${fraction}`;
}

/** "25.5" → "25500000". Returns null if the text isn't a valid positive amount. */
export function parseUsdc(text: string): string | null {
  const match = text.trim().match(/^(\d+)(?:\.(\d{0,6}))?$/);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  const baseUnits = BigInt(whole + fraction.padEnd(USDC_DECIMALS, "0"));
  return baseUnits > BigInt(0) ? baseUnits.toString() : null;
}

/**
 * Divides `baseUnits` between basis-point shares exactly like the contract does:
 * each share rounds down, and the remainder goes to the first one.
 */
export function splitAmount(baseUnits: string, basisPoints: number[]): string[] {
  const total = BigInt(baseUnits);
  const shares = basisPoints.map((bp) => (total * BigInt(bp)) / BigInt(10_000));
  const remainder = total - shares.reduce((sum, share) => sum + share, BigInt(0));
  if (shares.length > 0) shares[0] += remainder;
  return shares.map((share) => share.toString());
}
