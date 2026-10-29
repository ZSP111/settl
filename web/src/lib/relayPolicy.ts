/**
 * What Settl's relayer agrees to pay gas for. A meta transaction lets the relayer submit an
 * action the user signed; without limits, anyone could make the relayer pay for anything.
 * So only Settl's own freelancer/client actions are allowed, with no NEAR attached.
 */

/** Shape of a decoded NEP-366 delegate action (as produced by near-api-js' borsh schema). */
export interface DecodedDelegateAction {
  senderId: string;
  receiverId: string;
  actions: Array<{
    functionCall?: { methodName: string; args: Uint8Array; gas: bigint; deposit: bigint };
  }>;
}

export const RELAYABLE_METHODS = new Set(["create_invoice", "cancel_invoice", "release_escrow"]);
const MAX_ACTIONS = 2;
const MAX_GAS_PER_ACTION = BigInt(100) * BigInt(10) ** BigInt(12); // 100 TGas

/** Returns why the relayer must refuse this delegate action, or null if it's acceptable. */
export function rejectReason(action: DecodedDelegateAction, settlContract: string): string | null {
  if (action.receiverId !== settlContract) return "Only calls to the Settl contract are relayed";
  if (action.actions.length === 0 || action.actions.length > MAX_ACTIONS) return "Unexpected number of actions";
  for (const { functionCall } of action.actions) {
    if (!functionCall) return "Only function calls are relayed";
    if (!RELAYABLE_METHODS.has(functionCall.methodName)) return `Method ${functionCall.methodName} is not relayed`;
    if (functionCall.deposit !== BigInt(0)) return "Relayed calls must not attach NEAR";
    if (functionCall.gas > MAX_GAS_PER_ACTION) return "Too much gas requested";
  }
  return null;
}

/** Split recipients named in a relayed `create_invoice`, so the relayer can register them on USDC. */
export function splitRecipients(action: DecodedDelegateAction): string[] {
  const recipients = new Set<string>();
  for (const { functionCall } of action.actions) {
    if (functionCall?.methodName !== "create_invoice") continue;
    try {
      const args = JSON.parse(new TextDecoder().decode(functionCall.args));
      for (const split of args.splits ?? []) {
        if (typeof split.account_id === "string") recipients.add(split.account_id);
      }
    } catch {
      // Malformed args: the contract call will fail on its own.
    }
  }
  return [...recipients].slice(0, 5);
}
