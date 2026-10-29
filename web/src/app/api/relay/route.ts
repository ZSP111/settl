/**
 * POST /api/relay  { signedDelegate }  →  { transactionHash, outcome }
 *
 * Settl's relayer for NEAR meta transactions (NEP-366). The user's wallet signs a "delegate
 * action" (what they want to do), and the relayer wraps it in a transaction it signs and pays
 * gas for. Together with the contract's sponsor pool (which pays invoice storage), freelancers
 * can create invoices without holding any NEAR.
 *
 * Needs RELAYER_ACCOUNT_ID and RELAYER_PRIVATE_KEY (server-only env vars, never NEXT_PUBLIC).
 * The relayer account should hold only a small amount of NEAR.
 */
import { deserialize } from "borsh";
import { Account, base64Decode, SCHEMA } from "near-api-js";
import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { viewFunction } from "@/lib/near";
import { type DecodedDelegateAction, rejectReason, splitRecipients } from "@/lib/relayPolicy";
import { isRegisteredOnUsdc } from "@/lib/settl";

interface DecodedSignedDelegate {
  delegateAction: DecodedDelegateAction;
}

const TGAS = BigInt(10) ** BigInt(12);
const USDC_REGISTRATION = BigInt("1250000000000000000000"); // 0.00125 NEAR

export async function POST(request: Request) {
  const relayerId = process.env.RELAYER_ACCOUNT_ID;
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerId || !relayerKey) return error("Gasless transactions are not enabled on this deployment", 503);

  const { signedDelegate } = await request.json();
  let decoded: DecodedSignedDelegate;
  try {
    decoded = deserialize(SCHEMA.SignedDelegate, base64Decode(signedDelegate)) as DecodedSignedDelegate;
  } catch {
    return error("Invalid signed delegate action");
  }

  const reason = rejectReason(decoded.delegateAction, config.settlContract);
  if (reason) return error(reason, 403);

  const relayer = new Account(relayerId, config.rpcUrl, relayerKey as `ed25519:${string}`);

  try {
    // A brand-new freelancer usually can't receive USDC yet. The relayer registers the
    // invoice's split recipients itself, but only while the sender still has sponsored
    // invoices left, which caps how much one account can make the relayer spend.
    const recipients = splitRecipients(decoded.delegateAction);
    if (recipients.length > 0) {
      const sponsoredLeft = await viewFunction<number>(config.settlContract, "get_sponsored_invoices_left", {
        account_id: decoded.delegateAction.senderId,
      });
      if (sponsoredLeft === 0) return error("No sponsored invoices left for this account", 403);
      for (const accountId of recipients) {
        if (await isRegisteredOnUsdc(accountId)) continue;
        await relayer.callFunction({
          contractId: config.usdcContract,
          methodName: "storage_deposit",
          args: { account_id: accountId, registration_only: true },
          deposit: USDC_REGISTRATION,
          gas: BigInt(30) * TGAS,
        });
      }
    }

    const outcome = await relayer.relayMetaTransaction(decoded as never);
    return NextResponse.json({ transactionHash: outcome.transaction.hash, outcome });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Relaying failed", 502);
  }
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
