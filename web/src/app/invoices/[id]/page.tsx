import { Suspense } from "react";

import { InvoiceView } from "./InvoiceView";

export default function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading invoice…</p>}>
      <InvoiceView params={params} />
    </Suspense>
  );
}
