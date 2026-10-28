import type { Metadata, Viewport } from "next";

import { Header } from "@/components/Header";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Settl: crypto invoices for freelancers",
  description: "Send an invoice, get paid in USDC on NEAR. Automatic split payouts and escrow.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <WalletProvider>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
