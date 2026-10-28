/**
 * Read-only access to NEAR. View functions are free and need no wallet:
 * we send a JSON-RPC "query" request straight to a public RPC node.
 */
import { config } from "./config";

export async function viewFunction<T>(
  contractId: string,
  methodName: string,
  args: object = {},
): Promise<T> {
  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "settl",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "optimistic",
        account_id: contractId,
        method_name: methodName,
        args_base64: toBase64(JSON.stringify(args)),
      },
    }),
  });
  const json = await response.json();
  if (json.error || json.result?.error) {
    throw new Error(json.error?.data ?? json.result?.error ?? "RPC error");
  }
  // The contract's return value comes back as an array of bytes holding JSON.
  return JSON.parse(new TextDecoder().decode(new Uint8Array(json.result.result)));
}

/** Decodes a transaction's return value (base64-encoded JSON). */
export function decodeSuccessValue<T>(base64: string): T {
  return JSON.parse(new TextDecoder().decode(fromBase64(base64)));
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
