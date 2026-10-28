/**
 * Server-side client for NEAR Intents' 1-Click API (https://1click.chaindefuser.com).
 * Used only by our API routes. An API key (JWT from partners.near-intents.org) is optional:
 * without one, 1-Click adds a 0.2% fee (HACKATHON.md, Q-006).
 */
import "server-only";

const BASE_URL = "https://1click.chaindefuser.com";
/** USDC on NEAR mainnet, as a 1-Click asset id. */
export const USDC_NEAR_ASSET_ID = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

function headers(): HeadersInit {
  const jwt = process.env.ONECLICK_JWT;
  return {
    "Content-Type": "application/json",
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
}

export async function oneClick<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers: headers(), cache: "no-store" });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? `1-Click error ${response.status}`);
  return json;
}
