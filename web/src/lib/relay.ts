/** Browser side of gasless transactions: hand a wallet-signed delegate action to /api/relay. */
import { decodeSuccessValue } from "./near";

interface RelayResponse {
  transactionHash: string;
  outcome: { receipts_outcome: Array<{ outcome: { executor_id: string; status: { SuccessValue?: string } } }> };
}

export async function relaySignedDelegate(signedDelegate: string): Promise<RelayResponse> {
  const response = await fetch("/api/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedDelegate }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "The relayer could not send the transaction");
  return json;
}

/**
 * The value returned by `contractId` inside a relayed transaction. In a meta transaction the
 * contract call runs in a later receipt, so its return value is in `receipts_outcome`.
 */
export function returnValueFrom<T>(relayed: RelayResponse, contractId: string): T | null {
  for (const { outcome } of relayed.outcome.receipts_outcome) {
    const value = outcome.status.SuccessValue;
    if (outcome.executor_id === contractId && value) return decodeSuccessValue<T>(value);
  }
  return null;
}
