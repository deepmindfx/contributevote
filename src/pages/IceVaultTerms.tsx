import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";

export default function IceVaultTerms() {
  return (
    <div className="min-h-dvh">
      <Header />
      <main className="app-page mx-auto max-w-2xl space-y-6 py-8">
        <div className="space-y-2">
          <h1 className="app-page-title">Ice Vault terms</h1>
          <p className="text-sm text-muted-foreground">Version 1 · Effective 22 November 2026</p>
        </div>
        <div className="space-y-5 rounded-2xl border bg-card p-5 text-sm leading-relaxed sm:p-7">
          <section className="space-y-1">
            <h2 className="font-semibold">Locking money</h2>
            <p>Ice Vault sets aside money from your available CollectiPay wallet. Before confirming, check the amount, term and exact maturity time shown in Nigeria time. Once the lock starts, you cannot spend, transfer or withdraw the locked amount before maturity.</p>
          </section>
          <section className="space-y-1">
            <h2 className="font-semibold">What you receive</h2>
            <p>When a lock matures, CollectiPay returns the full principal to your wallet. Ice Vault has no locking fee and pays no interest or bonuses. Ordinary wallet transfer fees may apply if you send the money to a bank afterward.</p>
          </section>
          <section className="space-y-1">
            <h2 className="font-semibold">Payments and support</h2>
            <p>CollectiPay Enterprise Limited operates Ice Vault. Flutterwave processes wallet payments and bank transfers. The <a className="text-primary underline" href="https://flutterwave.com/ng/terms/" target="_blank" rel="noopener noreferrer">Flutterwave payment terms</a> apply to its services.</p>
            <p>Contact <a className="text-primary underline" href="mailto:support@collectipay.com">support@collectipay.com</a> about an incorrect lock, an unauthorised transaction or a delayed release. Applicable consumer and dispute rights continue to apply.</p>
          </section>
        </div>
        <Link to="/fixed-savings" className="text-sm font-medium text-primary underline underline-offset-4">Back to Ice Vault</Link>
      </main>
    </div>
  );
}
