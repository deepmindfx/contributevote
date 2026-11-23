import { ArrowUpRight, Download, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import { PAYROLL_CSV_NAME, PAYROLL_CSV_URL } from "@/lib/bulkTransfers";

const payroll = [
  { name: "Amina Bello", initials: "AB", amount: "₦125,000" },
  { name: "Chidi Okafor", initials: "CO", amount: "₦95,000" },
  { name: "Teni Adeyemi", initials: "TA", amount: "₦80,000" },
];

export function BulkPayrollSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section id="bulk-transfers" className="landing-payroll" aria-labelledby="payroll-title">
      <div className="landing-width landing-payroll-layout">
        <div className="landing-section-heading" data-scroll-reveal>
          <p className="landing-payroll-category">Bulk transfers</p>
          <h2 id="payroll-title">Pay your team in one batch.</h2>
          <p>Upload a payroll CSV, verify each bank account, and authorize the whole batch with one PIN. See fees and VAT before sending, then track each payment.</p>
          <div className="landing-actions">
            <Link to={isAuthenticated ? "/transfer/bulk" : "/auth?mode=signup&redirect=%2Ftransfer%2Fbulk"} className="landing-button landing-button-primary">
              Open bulk transfers <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a href={PAYROLL_CSV_URL} download={PAYROLL_CSV_NAME} className="landing-text-link">
              <Download size={17} aria-hidden="true" /> Download payroll CSV
            </a>
          </div>
        </div>

        <div className="landing-payroll-stage" data-scroll-reveal>
          <figure className="landing-payroll-sheet">
            <figcaption className="landing-payroll-sheet-heading">
              <span className="landing-payroll-symbol"><FileSpreadsheet size={22} aria-hidden="true" /></span>
              <span><small>Payroll example</small><strong>Monthly salaries</strong></span>
            </figcaption>
            <ul aria-label="Example salary payments">
              {payroll.map(({ name, initials, amount }) => (
                <li key={name}>
                  <span className="landing-payroll-person" aria-hidden="true">{initials}</span>
                  <span>{name}</span>
                  <strong>{amount}</strong>
                </li>
              ))}
            </ul>
            <div className="landing-payroll-total">
              <span><strong>₦300,000</strong><small>Before fees and VAT</small></span>
              <span>3 recipients</span>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
