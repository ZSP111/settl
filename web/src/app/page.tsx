import { ButtonLink, Card } from "@/components/ui";

const STEPS = [
  { title: "Create an invoice", text: "Amount in USDC, a due date, and who gets what share." },
  { title: "Share the link", text: "Send it over WhatsApp or email. Your client pays from their phone." },
  { title: "Get paid", text: "USDC lands in your NEAR account, split automatically. Or held in escrow until approved." },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="max-w-2xl space-y-5">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Invoices that settle themselves.
        </h1>
        <p className="text-lg text-muted">
          Create an invoice, send a link, receive USDC on NEAR. Payouts split between collaborators on-chain,
          with optional escrow until your client approves the work.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/invoices/new">Create an invoice</ButtonLink>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <Card key={step.title}>
            <p className="font-display text-sm font-bold text-accent">0{index + 1}</p>
            <h2 className="mt-2 font-display text-lg font-bold">{step.title}</h2>
            <p className="mt-1 text-sm text-muted">{step.text}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
