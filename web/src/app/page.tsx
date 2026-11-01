import Image from "next/image";
import Link from "next/link";

import { ButtonLink, Card } from "@/components/ui";
import { config } from "@/lib/config";

/** Real payments anyone can open, on the live deployments. */
const PROOF_LINKS = [
  {
    title: "Paid in NEAR, settled in USDC",
    text: "A real mainnet payment: NEAR swapped by NEAR Intents, delivered to the contract as exactly 1.00 USDC.",
    href: "https://settl-mainnet.vercel.app/pay/1",
    label: "Mainnet receipt",
  },
  {
    title: "Split 70/30 automatically",
    text: "One 2.00 USDC payment, paid out as 1.40 and 0.60 USDC to two accounts in the same transaction.",
    href: "https://web-seven-ruddy-87.vercel.app/pay/4",
    label: "Testnet receipt",
  },
  {
    title: "Income you can prove",
    text: "Every paid invoice for an account, read live from the blockchain. Shareable, printable.",
    href: "https://web-seven-ruddy-87.vercel.app/proof/billonaire.testnet",
    label: "Income proof",
  },
];

const FEATURES = [
  {
    title: "Pay with any crypto",
    text: "Clients pay with ETH, SOL, BTC, NEAR or USDC on other chains, from any wallet. NEAR Intents converts it to the exact invoice amount in USDC.",
  },
  {
    title: "Automatic splits",
    text: "Up to five collaborators, each paid their share by the smart contract the moment the client pays.",
  },
  {
    title: "Escrow",
    text: "The client pays up front; the money is held by the contract and released only when they approve the work.",
  },
  {
    title: "Free to create",
    text: "Your wallet only signs. Settl pays the network fee and storage, so you don't need any NEAR to start.",
  },
  {
    title: "Proof of income",
    text: "A public page listing what you've been paid, verifiable by anyone on-chain. Save it as a PDF for a landlord or bank.",
  },
  {
    title: "Nothing gets lost",
    text: "Wrong payments are refunded automatically, and a payout that can't be delivered is kept for its recipient to withdraw.",
  },
];

const TOKENS = ["USDC", "ETH", "SOL", "BTC", "NEAR"];

export default function Home() {
  return (
    <div className="space-y-16 sm:space-y-20">
      <section className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl space-y-5">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Invoices that settle themselves.
          </h1>
          <p className="text-lg text-muted">
            Send one link. Your client pays with the crypto they already hold. You receive USDC on NEAR, split
            between collaborators automatically, or held in escrow until the work is approved.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/invoices/new">Create an invoice</ButtonLink>
            <a
              href="https://settl-mainnet.vercel.app/pay/1"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-white px-5 font-semibold transition hover:bg-surface"
            >
              See a live payment
            </a>
          </div>
          <div className="space-y-2 pt-2">
            <p className="text-sm font-semibold text-muted">Your client pays with</p>
            <ul className="flex flex-wrap gap-2">
              {TOKENS.map((token) => (
                <li key={token} className="rounded-full border border-line bg-white px-3 py-1 font-display text-sm font-semibold">
                  {token}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mx-auto w-64 rounded-[2.5rem] border-[10px] border-ink bg-ink shadow-xl sm:w-72">
          <Image
            src="/screens/pay-page.png"
            alt="Settl pay page on a phone, with live prices for paying in other crypto"
            width={780}
            height={1560}
            priority
            className="rounded-[1.75rem]"
          />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Create an invoice", text: "Amount in USDC, a due date, and who gets what share." },
            { title: "Share the link", text: "Send it over WhatsApp or email. Your client pays from their phone." },
            { title: "Get paid", text: "USDC lands in your NEAR account, already split. Or held in escrow until approved." },
          ].map((step, index) => (
            <Card key={step.title}>
              <p className="font-display text-sm font-bold text-accent">0{index + 1}</p>
              <h3 className="mt-2 font-display text-lg font-bold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Everything a freelancer needs to get paid</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <h3 className="font-display text-lg font-bold">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted">{feature.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Proven on NEAR</h2>
          <p className="mt-1 text-muted">Real payments on the live contracts. Open them, nothing to install.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PROOF_LINKS.map((proof) => (
            <a key={proof.href} href={proof.href} className="group block">
              <Card className="h-full transition group-hover:border-accent">
                <h3 className="font-display text-lg font-bold">{proof.title}</h3>
                <p className="mt-1 text-sm text-muted">{proof.text}</p>
                <p className="mt-3 text-sm font-semibold text-accent">{proof.label} →</p>
              </Card>
            </a>
          ))}
        </div>
      </section>

      <footer className="flex flex-col gap-3 border-t border-line pt-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Built at NEAR HACKATHON · Contract{" "}
          <a href={`${config.explorerUrl}/address/${config.settlContract}`} className="font-semibold text-ink hover:text-accent">
            {config.settlContract}
          </a>
        </p>
        <div className="flex gap-4 font-semibold">
          <Link href="/dashboard" className="hover:text-ink">
            Dashboard
          </Link>
          {/* The source link is for hackathon judges on the demo site, not for mainnet users. */}
          {config.network === "testnet" && (
            <a href="https://github.com/ZSP111/settl" className="hover:text-ink">
              GitHub
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
