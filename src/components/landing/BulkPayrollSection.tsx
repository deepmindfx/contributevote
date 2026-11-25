import { ArrowRight, CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import { PAYROLL_CSV_NAME, PAYROLL_CSV_URL } from "@/lib/bulkTransfers";

const payroll = [
  { name: "Amina Bello", bank: "GTBank · 0148829014", initials: "AB", amount: "₦125,000" },
  { name: "Chidi Okafor", bank: "Moniepoint · 8161074642", initials: "CO", amount: "₦95,000" },
  { name: "Teni Adeyemi", bank: "OPay · 7063657261", initials: "TA", amount: "₦80,000" },
];

export function BulkPayrollSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section id="bulk-transfers" className="cb-section cb-section--bordered" aria-labelledby="payroll-title">
      <div className="cb-container cb-payroll-grid">
        <div className="cb-payroll-copy" data-scroll-reveal>
          <span className="cb-kicker-pill">
            <FileSpreadsheet size={14} aria-hidden="true" />
            BULK TRANSFERS &amp; PAYROLL
          </span>

          <h2 id="payroll-title">Pay your team &amp; vendors in one verified batch.</h2>

          <p>
            Select recipients across any Nigerian bank or upload a ready-made payroll CSV. Verify
            account names, review upfront fees and VAT, and authorize the entire batch with a
            single 4-digit PIN.
          </p>

          <ul className="cb-payroll-checks">
            <li>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>Automatic account-name resolution before money leaves your wallet</span>
            </li>
            <li>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>One 4-digit PIN authorizes up to dozens of transfers at once</span>
            </li>
            <li>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>Individual shareable CollectiPay receipts for every recipient</span>
            </li>
          </ul>

          <div className="cb-hero-actions">
            <Link
              to={isAuthenticated ? "/transfer/bulk" : "/auth?mode=signup&redirect=%2Ftransfer%2Fbulk"}
              className="cb-btn cb-btn--primary"
            >
              <span>Open Bulk Transfers</span>
              <ArrowRight size={17} strokeWidth={2.3} aria-hidden="true" />
            </Link>

            <a href={PAYROLL_CSV_URL} download={PAYROLL_CSV_NAME} className="cb-btn cb-btn--ghost">
              <Download size={17} className="text-[#059669]" aria-hidden="true" />
              <span>Download Payroll CSV</span>
            </a>
          </div>
        </div>

        <div className="cb-payroll-stage" data-scroll-reveal>
          <figure className="cb-payroll-card">
            <figcaption className="cb-payroll-card-head">
              <div className="cb-payroll-card-title">
                <span className="cb-payroll-icon" aria-hidden="true">
                  <FileSpreadsheet size={20} />
                </span>
                <div>
                  <small>Verified CSV Batch</small>
                  <strong>Monthly Team Salaries</strong>
                </div>
              </div>
              <span className="cb-payroll-status">Ready · 3 Verified</span>
            </figcaption>

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

            <div className="cb-payroll-foot">
              <div>
                <span>Total Batch Disbursement</span>
                <strong>₦300,000.00</strong>
              </div>
              <span className="cb-payroll-pin-pill">1-PIN Batch Auth</span>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
