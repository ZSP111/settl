import { Suspense } from "react";

import { PayView } from "./PayView";

export default function PayPage({ params }: PageProps<"/pay/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading invoice…</p>}>
      <PayView params={params} />
    </Suspense>
  );
}
