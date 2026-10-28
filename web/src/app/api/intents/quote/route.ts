/**
 * POST /api/intents/quote  { invoiceId, optionId, refundTo, dry }
 *
 * Asks 1-Click how much of the client's token pays the invoice exactly. The invoice amount is
 * read from the contract here on the server, so the browser can't change what gets delivered.
 * With dry=false the response includes a one-time deposit address.
 */
import { NextResponse } from "next/server";

import { config, intentsLive } from "@/lib/config";
import { INTENTS_CONTRACT, isValidAddress, PAYMENT_OPTIONS, type Quote } from "@/lib/intents";
import { oneClick, USDC_NEAR_ASSET_ID } from "@/lib/oneClick";
import { getInvoice } from "@/lib/settl";

const ONE_HOUR_MS = 60 * 60 * 1000;

interface QuoteResponse {
  quote: Quote;
}

export async function POST(request: Request) {
  const { invoiceId, optionId, refundTo, dry } = await request.json();

  const option = PAYMENT_OPTIONS.find((o) => o.id === optionId);
  if (!option) return error("Unknown payment option");
  if (typeof refundTo !== "string" || !isValidAddress(option.addressKind, refundTo)) {
    return error("That doesn't look like a valid address for this network");
  }
  if (!dry && !intentsLive) return error("Paying with other crypto is only available on mainnet");

  const invoice = await getInvoice(Number(invoiceId));
  if (!invoice) return error("Invoice not found", 404);
  if (invoice.status !== "Unpaid") return error("This invoice is not awaiting payment");
  if (invoice.escrow) return error("Escrow invoices must be paid from a NEAR wallet");

  // Bitcoin confirmations are slow, so give BTC deposits more time before a refund kicks in.
  const deadline = new Date(Date.now() + (option.addressKind === "bitcoin" ? 3 : 1) * ONE_HOUR_MS);

  try {
    const { quote } = await oneClick<QuoteResponse>("/v0/quote", {
      method: "POST",
      body: JSON.stringify({
        dry: Boolean(dry),
        // The invoice amount is fixed; slippage is absorbed on the client's side.
        swapType: "EXACT_OUTPUT",
        slippageTolerance: 100,
        originAsset: option.assetId,
        depositType: "ORIGIN_CHAIN",
        destinationAsset: USDC_NEAR_ASSET_ID,
        amount: invoice.amount,
        refundTo: refundTo.trim(),
        refundType: "ORIGIN_CHAIN",
        // On testnet there is no Intents, so preview prices with a placeholder mainnet recipient.
        recipient: intentsLive ? config.settlContract : INTENTS_CONTRACT,
        recipientType: "DESTINATION_CHAIN",
        // Delivered with ft_transfer_call, so Settl's ft_on_transfer sees the invoice id.
        customRecipientMsg: JSON.stringify({ invoice_id: invoice.id }),
        deadline: deadline.toISOString(),
        referral: "settl",
      }),
    });
    return NextResponse.json({
      amountIn: quote.amountIn,
      amountInFormatted: quote.amountInFormatted,
      amountInUsd: quote.amountInUsd,
      timeEstimate: quote.timeEstimate,
      depositAddress: quote.depositAddress,
      depositMemo: quote.depositMemo,
      deadline: quote.deadline,
    } satisfies Quote);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Could not get a quote", 502);
  }
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
