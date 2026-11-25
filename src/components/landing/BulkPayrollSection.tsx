import { ArrowRight, CheckCircle2, Download, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PAYROLL_CSV_NAME, PAYROLL_CSV_URL } from "@/lib/bulkTransfers";

const payroll = [
  { name: "Amina Bello", bank: "GTBank · 0148829014", initials: "AB", amount: "₦125,000" },
  { name: "Chidi Okafor", bank: "Moniepoint · 8161074642", initials: "CO", amount: "₦95,000" },
  { name: "Teni Adeyemi", bank: "OPay · 7063657261", initials: "TA", amount: "₦80,000" },
];

export function BulkPayrollSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section id="bulk-transfers" className="cb-section" aria-labelledby="payroll-title">
      <div className="cb-container">
        {/* Cashbuddy-Aligned Soft Pastel Rounded-[32px] Wide Feature Showcase */}
        <div className="cb-payroll-showcase" data-scroll-reveal>
          <div className="cb-payroll-grid">
            <div className="cb-payroll-copy">
              <span className="cb-soft-badge cb-soft-badge--emerald">
                Bulk Payroll &amp; Batch Payouts
              </span>

              <h2 id="payroll-title">Pay your team &amp; vendors in one verified batch</h2>

              <p>
                Select recipients across any Nigerian bank or upload a ready-made payroll CSV.
                Verify account names automatically, review upfront fees, and authorize the entire
                batch with a single 4-digit PIN.
              </p>

              <div className="cb-payroll-links">
                <Link
                  to={
                    isAuthenticated
                      ? "/transfer/bulk"
                      : "/auth?mode=signup&redirect=%2Ftransfer%2Fbulk"
                  }
                  className="cb-inline-cta"
                >
                  <span>Open Bulk Transfers</span>
                  <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
                </Link>

                <a
                  href={PAYROLL_CSV_URL}
                  download={PAYROLL_CSV_NAME}
                  className="cb-inline-cta cb-inline-cta--muted"
                >
                  <Download size={15} aria-hidden="true" />
                  <span>Download CSV template</span>
                </a>
              </div>
            </div>

            <div className="cb-payroll-cards">
              <figure className="cb-payroll-card">
                <figcaption className="cb-payroll-card-head">
                  <strong>Payroll Summary</strong>
                  <span className="cb-payroll-status">3 Verified</span>
                </figcaption>

                <div className="cb-payroll-kpis">
                  <div>
                    <strong>₦300,000</strong>
                    <span>TOTAL BATCH</span>
                  </div>
                  <div>
                    <strong>3 Banks</strong>
                    <span>AUTO-VERIFIED</span>
                  </div>
                  <div>
                    <strong>1 PIN</strong>
                    <span>SINGLE AUTH</span>
                  </div>
                </div>

                <ul className="cb-payroll-list" aria-label="Example salary payments">
                  {payroll.map(({ name, bank, initials, amount }) => (
                    <li key={name}>
                      <span className="cb-payroll-avatar" aria-hidden="true">
                        {initials}
                      </span>
                      <div className="cb-payroll-person-meta">
                        <strong>{name}</strong>
                        <small>{bank}</small>
                      </div>
                      <strong className="cb-payroll-amount">{amount}</strong>
                    </li>
                  ))}
                </ul>
              </figure>

              {/* Cashbuddy-style Slim Auxiliary Verification Pill Bar */}
              <div className="cb-payroll-assist" aria-hidden="true">
                <span className="cb-payroll-assist-icon">
                  <CheckCircle2 size={16} strokeWidth={2.3} />
                </span>
                <div className="cb-payroll-assist-copy">
                  <div className="cb-payroll-assist-title">
                    <strong>Batch Verification Engine</strong>
                    <span className="cb-payroll-assist-tag">LIVE</span>
                  </div>
                  <small>Account-name match &amp; shareable receipts for every recipient</small>
                </div>
                <ShieldCheck size={16} className="text-[#94a3b8] shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
