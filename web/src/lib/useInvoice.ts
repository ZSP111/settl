"use client";

import { useCallback, useEffect, useState } from "react";

import { getInvoice, type Invoice } from "./settl";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; invoice: Invoice }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

/** Loads one invoice from the contract. `reload()` fetches it again (e.g. after a payment). */
export function useInvoice(invoiceId: number) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const request = Number.isSafeInteger(invoiceId) ? getInvoice(invoiceId) : Promise.resolve(null);
    request
      .then((invoice) => {
        if (!cancelled) setState(invoice ? { kind: "loaded", invoice } : { kind: "not-found" });
      })
      .catch((err) => {
        if (!cancelled) setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    invoice: state.kind === "loaded" ? state.invoice : null,
    notFound: state.kind === "not-found",
    error: state.kind === "error" ? state.message : null,
    loading: state.kind === "loading",
    reload,
  };
}
