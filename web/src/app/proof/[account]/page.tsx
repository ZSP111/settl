import { Suspense } from "react";

import { ProofView } from "./ProofView";

export default function ProofPage({ params }: PageProps<"/proof/[account]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading income history…</p>}>
      <ProofView params={params} />
    </Suspense>
  );
}
