import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Compass,
  HeartHandshake,
  Lock,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Vote,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { BulkPayrollSection } from "@/components/landing/BulkPayrollSection";
import { CommunityStoriesSection } from "@/components/landing/CommunityStoriesSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { SmartShowcaseSection } from "@/components/landing/SmartShowcaseSection";
import "@/styles/landing.css";

const HERO_ROTATING_PHRASES = [
  { text: "decide together.", tone: "emerald", tag: "VOTING", badge: "70% Quorum · 60% Yes Rule" },
  { text: "pool with clarity.", tone: "teal", tag: "POOLS", badge: "Dedicated NGN Virtual Accounts" },
  { text: "pay teams faster.", tone: "indigo", tag: "PAYROLL", badge: "1-PIN CSV Batch Transfers" },
  { text: "lock every goal.", tone: "amber", tag: "VAULT", badge: "Fixed Target Savings Vault" },
] as const;

const BENTO_STEPS = [
  {
    icon: UsersRound,
    tone: "mint",
    title: "Bring your group together",
    description:
      "Set a clear Naira goal, write transparent group rules, and share a private invite link or list your cause publicly on Discover.",
    widgetType: "invite" as const,
  },
  {
    icon: WalletCards,
    tone: "sky",
    title: "Collect in one place",
    description:
      "Fund from your CollectiPay wallet, pay by card, or receive bank transfers straight into a dedicated NGN virtual account.",
    widgetType: "account" as const,
  },
  {
    icon: Vote,
    tone: "lavender",
    title: "Decide together",
    description:
      "Enable contributor voting so 70% participation and 60% approval are recorded before withdrawals or refunds move.",
    widgetType: "vote" as const,
  },
];

const comparisons = [
  {
    feature: "Joining & rules",
    manual: "Rules and invitations buried across long group chats",
    product: "Structured invite links and clear rules members review before joining",
  },
  {
    feature: "Incoming payments",
    manual: "Bank transfer screenshots reconciled manually",
    product: "Automatic in-app receipts plus admin-verified bank transfer matching",
  },
  {
    feature: "Record keeping",
    manual: "Spreadsheets updated by hand with version drift",
    product: "Live group ledger, downloadable receipts, and monthly owner insights",
  },
  {
    feature: "Withdrawal approvals",
    manual: "Informal voice notes and disputed approvals",
    product: "Auditable contributor votes (70% quorum / 60% yes) before funds move",
  },
  {
    feature: "Sending & payroll",
    manual: "Account numbers copied across multiple apps",
    product: "1-tap verified bank beneficiaries and CSV batch payroll with one PIN",
  },
];

function HeroVisualShowcase() {
  return (
    <div className="cb-hero-visual">
      <div className="cb-hero-glow" aria-hidden="true" />
      <figure className="cb-hero-hand-stage">
        <img
          src="/images/collectipay-hero-hand.webp?v=6"
          srcSet="/images/collectipay-hero-hand-small.webp?v=6 720w, /images/collectipay-hero-hand.webp?v=6 1200w"
          sizes="(min-width: 64rem) 42vw, (min-width: 40rem) 65vw, 94vw"
          width={1200}
          height={1420}
          alt="Hand with emerald nails holding an iPhone in a mint-white pouch displaying the CollectiPay dark-emerald wallet and community groups dashboard"
          fetchPriority="high"
          decoding="async"
          className="cb-hero-hand-img"
        />
      </figure>
    </div>
  );
}

function NigeriaFlagIcon() {
  return (
    <svg
      width="16"
      height="11"
      viewBox="0 0 16 11"
      fill="none"
      aria-hidden="true"
      className="inline-block rounded-[2px] align-middle"
    >
      <rect width="16" height="11" rx="2" fill="#FFFFFF" />
      <rect width="5.33" height="11" rx="1" fill="#008751" />
      <rect x="10.67" width="5.33" height="11" rx="1" fill="#008751" />
    </svg>
  );
}

export default function Index() {
  const { isAuthenticated } = useSupabaseUser();
  const startPath = isAuthenticated ? "/create-group" : "/auth?mode=signup";
  const startLabel = isAuthenticated ? "Create a Group" : "Open Free Account";
  const mainRef = useRef<HTMLElement>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [motionPhase, setMotionPhase] = useState<"idle" | "exiting" | "entering">("idle");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    let swapTimer: number | undefined;
    let settleTimer: number | undefined;

    const interval = window.setInterval(() => {
      // 1. Ease current text out smoothly (slow start -> fast exit)
      setMotionPhase("exiting");

      // 2. Once old text has completely exited, swap to next phrase and glide up from bottom
      swapTimer = window.setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % HERO_ROTATING_PHRASES.length);
        setMotionPhase("entering");

        settleTimer = window.setTimeout(() => {
          setMotionPhase("idle");
        }, 560);
      }, 270);
    }, 3600);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(swapTimer);
      window.clearTimeout(settleTimer);
    };
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    main.querySelectorAll("[data-scroll-reveal]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const currentPhrase = HERO_ROTATING_PHRASES[phraseIndex];

  return (
    <div className="landing cb-landing">
      <a href="#landing-main" className="landing-skip">
        Skip to content
      </a>

      {/* Cashbuddy-Inspired Fixed Glassmorphic Home Header */}
      <LandingHeader isAuthenticated={isAuthenticated} startPath={startPath} />

      <main id="landing-main" ref={mainRef} tabIndex={-1}>
        {/* SECTION 1: Full-Fold 12-Column Cashbuddy-Grade Hero */}
        <section className="cb-hero" aria-labelledby="landing-title">
          <div className="cb-hero-grid-bg" aria-hidden="true" />

          <div className="cb-container cb-hero-grid">
            <div className="cb-hero-copy">
              {/* Cashbuddy-Exact Light-Weight Dynamic Kicker Pill (Sequential Zero-Overlap) */}
              <div className="cb-hero-kicker" aria-live="polite">
                <span className="cb-hero-kicker-stage">
                  <span
                    key={`k-${phraseIndex}`}
                    className={`cb-hero-kicker-slide ${
                      motionPhase === "exiting"
                        ? "cb-hero-kicker-slide--exit"
                        : motionPhase === "entering"
                          ? "cb-hero-kicker-slide--enter"
                          : ""
                    }`}
                  >
                    <span className="cb-hero-kicker-tag">{currentPhrase.tag}</span>
                    <span className="cb-hero-kicker-text">{currentPhrase.badge}</span>
                  </span>
                </span>
              </div>

              <h1 id="landing-title" className="cb-hero-title">
                Save together,
                <span className="cb-hero-rotator" aria-live="polite">
                  <span
                    key={`h-${phraseIndex}`}
                    className={`cb-hero-accent cb-hero-accent--${currentPhrase.tone} ${
                      motionPhase === "exiting"
                        ? "cb-hero-accent--exit"
                        : motionPhase === "entering"
                          ? "cb-hero-accent--enter"
                          : ""
                    }`}
                  >
                    {currentPhrase.text}
                  </span>
                </span>
              </h1>

              <p className="cb-hero-lead">
                CollectiPay helps groups, families, faith communities, and teams pool Naira
                transparently, vote democratically on payouts, lock target savings, and send
                instant bank transfers in one app.
              </p>

              {/* Dual CTA Row: Dominant Dark Primary + Clean Flat Secondary */}
              <div className="cb-hero-actions">
                <Link to={startPath} className="cb-btn cb-btn--primary">
                  <span>{startLabel}</span>
                  <ArrowRight size={16} strokeWidth={2.3} aria-hidden="true" />
                </Link>

                <Link to="/discover" className="cb-btn cb-btn--ghost">
                  <Compass size={17} className="text-[#059669]" aria-hidden="true" />
                  <span>Explore Public Groups</span>
                  <ArrowRight size={15} className="text-[#059669]" aria-hidden="true" />
                </Link>
              </div>

              {/* Micro-Trust Checkmark Strip */}
              <div className="cb-hero-checks">
                <span>
                  <CheckCircle2 size={15} aria-hidden="true" /> 70% Voter Quorum Protection
                </span>
                <span>
                  <CheckCircle2 size={15} aria-hidden="true" /> Zero Monthly Account Fees
                </span>
              </div>

              {/* Hairline-Separated 3-Column Metrics Strip */}
              <div className="cb-hero-metrics" aria-label="Platform highlights">
                <div>
                  <strong>70% / 60%</strong>
                  <span>Vote &amp; Approval Rule</span>
                </div>
                <div>
                  <strong>0% Fee</strong>
                  <span>Charity Withdrawals</span>
                </div>
                <div>
                  <strong>Instant</strong>
                  <span>NGN Virtual Accounts</span>
                </div>
              </div>
            </div>

            <HeroVisualShowcase />
          </div>
        </section>

        {/* SECTION 2: 3-Card Pastel Bento Grid ("How it works") */}
        <section id="how-it-works" className="cb-section" aria-labelledby="how-title">
          <div className="cb-container">
            <div className="cb-section-header" data-scroll-reveal>
              <h2 id="how-title">
                One place to run a group fund
                <br className="landing-heading-break" /> from first kobo to final payout.
              </h2>
              <p>
                Built for savings circles, community infrastructure, faith collections, and shared
                plans where every member deserves full visibility.
              </p>
            </div>

            <div className="cb-bento-grid">
              {BENTO_STEPS.map(({ icon: Icon, tone, title, description, widgetType }) => (
                <article
                  key={title}
                  className={`cb-bento-card cb-bento-card--${tone}`}
                  data-scroll-reveal
                >
                  <div className="cb-bento-body">
                    <span className="cb-bento-icon" aria-hidden="true">
                      <Icon size={21} strokeWidth={2} />
                    </span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>

                  {/* Cashbuddy-Style Tall Rich Embedded Fintech Widget */}
                  <div className="cb-bento-widget" aria-hidden="true">
                    {widgetType === "invite" && (
                      <div className="cb-mini-widget">
                        <div className="cb-mini-pills-row">
                          <span className="cb-mini-chip cb-mini-chip--active">Public Pool</span>
                          <span className="cb-mini-chip">Invite Only</span>
                          <span className="cb-mini-chip">0% Charity</span>
                        </div>
                        <div className="cb-mini-row">
                          <span className="cb-mini-label">Target Goal</span>
                          <strong>₦420,000</strong>
                        </div>
                        <div className="cb-mini-row">
                          <span className="cb-mini-label">Active Members</span>
                          <strong className="text-[#059669]">24 Contributors</strong>
                        </div>
                        <div className="cb-mini-foot">
                          <span>
                            <ShieldCheck size={13} /> Rules locked upfront
                          </span>
                          <strong>Verified Ledger</strong>
                        </div>
                      </div>
                    )}

                    {widgetType === "account" && (
                      <div className="cb-mini-widget">
                        <div className="cb-mini-row">
                          <span className="cb-mini-label">Dedicated NGN Account</span>
                          <span className="cb-mini-pill cb-mini-pill--emerald">Instant Credit</span>
                        </div>
                        <div className="cb-mini-transfer-box">
                          <div>
                            <small>Bank Partner</small>
                            <strong>Flutterwave MFB</strong>
                          </div>
                          <ArrowRight size={14} className="text-[#94a3b8] shrink-0" />
                          <div className="text-right">
                            <small>Account Number</small>
                            <strong className="text-[#2563eb]">978 000 5281</strong>
                          </div>
                        </div>
                        <div className="cb-mini-foot">
                          <span>
                            <Building2 size={13} /> Auto-reconciled receipts
                          </span>
                          <strong>All NG Banks</strong>
                        </div>
                      </div>
                    )}

                    {widgetType === "vote" && (
                      <div className="cb-mini-widget cb-mini-widget--stack">
                        <div className="cb-mini-dark-card">
                          <div className="cb-mini-dark-top">
                            <span>QUORUM GOVERNANCE VOTE</span>
                            <span className="cb-mini-live-dot">PASSED</span>
                          </div>
                          <p className="cb-mini-dark-amount">₦420,000.00</p>
                          <div className="cb-mini-dark-foot">
                            <span>Turnout 76%</span>
                            <strong>84% Yes Approved</strong>
                          </div>
                        </div>
                        <div className="cb-mini-bar">
                          <span style={{ width: "84%" }} />
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: PRESERVED "Pool, send, and save smarter" Scroll-Expanding Portal */}
        <SmartShowcaseSection />

        {/* SECTION 4: Cashbuddy-Style Soft Pastel Bulk Payroll Showcase */}
        <BulkPayrollSection isAuthenticated={isAuthenticated} />

        {/* SECTION 5: Asymmetric Comparison Matrix ("Why CollectiPay?") */}
        <section id="why-collectipay" className="cb-section" aria-labelledby="why-title">
          <div className="cb-container">
            <div className="cb-section-header" data-scroll-reveal>
              <span className="cb-kicker-pill">
                <ShieldCheck size={14} aria-hidden="true" />
                Why CollectiPay
              </span>
              <h2 id="why-title">Why stick to manual group chats &amp; spreadsheets?</h2>
              <p>
                Keep incoming contributions, verified bank receipts, and payout votes where every
                member can audit them in real time.
              </p>
            </div>

            <div className="cb-compare-card" data-scroll-reveal>
              <table className="landing-compare" aria-labelledby="why-title">
                <thead>
                  <tr>
                    <th scope="col">What you manage</th>
                    <th scope="col">Manual WhatsApp / Cash</th>
                    <th scope="col">With CollectiPay</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map(({ feature, manual, product }) => (
                    <tr key={feature}>
                      <th scope="row">{feature}</th>
                      <td>
                        <span className="landing-compare-mobile-label" aria-hidden="true">
                          Manual groups
                        </span>
                        {manual}
                      </td>
                      <td>
                        <span className="landing-compare-mobile-label" aria-hidden="true">
                          With CollectiPay
                        </span>
                        <span className="landing-compare-benefit">
                          <span className="cb-compare-check" aria-hidden="true">
                            <Check size={13} strokeWidth={3} />
                          </span>
                          <span>{product}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 6: Transparent Group Fees (Dual Pastel Bento Cards) */}
        <section id="pricing" className="cb-section" aria-labelledby="pricing-title">
          <div className="cb-container">
            <div className="cb-section-header" data-scroll-reveal>
              <span className="cb-kicker-pill">
                <WalletCards size={14} aria-hidden="true" />
                Clear, Upfront Fees
              </span>
              <h2 id="pricing-title">Simple, transparent group fees.</h2>
              <p>
                Always review the exact platform fee and net recipient payout before confirming any
                withdrawal or transfer.
              </p>
            </div>

            <div className="cb-pricing-grid" data-scroll-reveal>
              <article className="cb-pricing-card cb-pricing-card--cream">
                <div className="cb-pricing-top">
                  <span className="cb-pricing-icon">
                    <WalletCards size={20} aria-hidden="true" />
                  </span>
                  <span className="cb-pricing-tag">Standard Pools</span>
                </div>
                <h3>Group withdrawals</h3>
                <p className="cb-pricing-headline">Small upfront %</p>
                <p className="cb-pricing-desc">
                  Calculated automatically on withdrawal requests so organizers and voters see the
                  exact net Naira payout upfront — with zero monthly maintenance charges.
                </p>
                <ul className="cb-pricing-list">
                  <li>
                    <CheckCircle2 size={15} aria-hidden="true" /> Free wallet-to-pool contributions
                  </li>
                  <li>
                    <CheckCircle2 size={15} aria-hidden="true" /> Daily &amp; Friday free transfer allowances
                  </li>
                </ul>
              </article>

              <article className="cb-pricing-card cb-pricing-card--mint">
                <div className="cb-pricing-top">
                  <span className="cb-pricing-icon cb-pricing-icon--emerald">
                    <HeartHandshake size={20} aria-hidden="true" />
                  </span>
                  <span className="cb-pricing-tag cb-pricing-tag--emerald">0% Platform Fee</span>
                </div>
                <h3>Charity &amp; faith withdrawals</h3>
                <p className="cb-pricing-headline">0% Fee</p>
                <p className="cb-pricing-desc">
                  Verified mosques, churches, medical relief drives, and community outreach pools
                  keep 100% of their raised contributions with zero CollectiPay withdrawal fee.
                </p>
                <ul className="cb-pricing-list">
                  <li>
                    <CheckCircle2 size={15} aria-hidden="true" /> 100% of raised funds go to the cause
                  </li>
                  <li>
                    <CheckCircle2 size={15} aria-hidden="true" /> Instant shareable contributor receipts
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* SECTION 7: Community Impact Stories (Light Brand Surface) */}
        <CommunityStoriesSection />

        {/* SECTION 8: Cashbuddy-Style Clean 2-Column FAQ */}
        <FaqSection />

        {/* SECTION 9: Cashbuddy-Style Dark Floating Island Final CTA */}
        <section className="cb-cta-outer" aria-labelledby="start-title">
          <div className="cb-cta-island" data-scroll-reveal>
            <div className="cb-cta-glow cb-cta-glow--emerald" aria-hidden="true" />
            <div className="cb-cta-glow cb-cta-glow--blue" aria-hidden="true" />

            <div className="cb-cta-content">
              <span className="cb-cta-pill">
                <Sparkles size={13} aria-hidden="true" /> Get Started Free in 60 Seconds
              </span>

              <h2 id="start-title">What are you saving for together?</h2>

              <p>
                Launch a transparent contribution pool, open your dedicated NGN wallet, pay your
                team in bulk, or lock personal savings in Ice Vault — all in one secure platform.
              </p>

              <div className="cb-cta-buttons">
                <Link to={startPath} className="cb-btn cb-btn--cta-light">
                  <span>{startLabel}</span>
                  <ArrowRight size={17} strokeWidth={2.3} aria-hidden="true" />
                </Link>

                <Link to="/discover" className="cb-btn cb-btn--cta-glass">
                  <span>Explore Public Groups</span>
                </Link>
              </div>

              <div className="cb-cta-reassurance">
                <span>
                  <CheckCircle2 size={14} aria-hidden="true" /> Zero maintenance charges
                </span>
                <span>
                  <CheckCircle2 size={14} aria-hidden="true" /> 4-Digit PIN &amp; Quorum Security
                </span>
                <span>
                  <CheckCircle2 size={14} aria-hidden="true" /> Instant Nigerian Bank Payouts
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* SECTION 10: Cashbuddy-Aligned Multi-Column Fintech Footer */}
      <footer className="cb-footer">
        <div className="cb-container">
          <div className="cb-footer-grid">
            <div className="cb-footer-brand-col">
              <Link to="/" className="cb-brand">
                <CollectiPayMark size={30} />
                <span className="cb-brand-name">
                  collectipay<sup aria-hidden="true">®</sup>
                </span>
              </Link>
              <p className="cb-footer-tagline">Save together. Decide together.</p>
              <p className="cb-footer-blurb">
                Whether you’re running a family circle, mosque or church project, startup milestone
                pool, or monthly team payroll, CollectiPay keeps every Naira transparent and
                accountable.
              </p>
            </div>

            <div className="cb-footer-links-grid">
              <div>
                <h4>Products</h4>
                <ul>
                  <li>
                    <Link to="/discover">Contribution Pools</Link>
                  </li>
                  <li>
                    <a href="#smart-experience">Democratic Voting</a>
                  </li>
                  <li>
                    <Link to="/transfer">1-Tap Bank Transfers</Link>
                  </li>
                  <li>
                    <a href="#bulk-transfers">Bulk Payroll CSV</a>
                  </li>
                  <li>
                    <Link to="/fixed-savings">Ice Vault Savings</Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4>Use Cases</h4>
                <ul>
                  <li>
                    <a href="#stories">Mosques &amp; Waqf</a>
                  </li>
                  <li>
                    <a href="#stories">Churches &amp; Outreach</a>
                  </li>
                  <li>
                    <a href="#stories">Families &amp; Ajo Circles</a>
                  </li>
                  <li>
                    <a href="#stories">Inventors &amp; Makers</a>
                  </li>
                  <li>
                    <a href="#bulk-transfers">SME Team Salaries</a>
                  </li>
                </ul>
              </div>

              <div>
                <h4>Resources</h4>
                <ul>
                  <li>
                    <a href="#how-it-works">How It Works</a>
                  </li>
                  <li>
                    <a href="#why-collectipay">Why CollectiPay</a>
                  </li>
                  <li>
                    <a href="#pricing">Transparent Pricing</a>
                  </li>
                  <li>
                    <Link to="/faq">Help Center &amp; FAQ</Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4>Security &amp; Access</h4>
                <ul>
                  <li>
                    <Link to={isAuthenticated ? "/dashboard" : "/auth"}>
                      {isAuthenticated ? "Open Dashboard" : "Member Sign In"}
                    </Link>
                  </li>
                  <li>
                    <Link to={startPath}>Create Free Account</Link>
                  </li>
                  <li>
                    <a href="#why-collectipay">70% Voter Quorum Rule</a>
                  </li>
                  <li>
                    <span className="cb-footer-static">
                      <Lock size={12} aria-hidden="true" /> PIN-Protected Transfers
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="cb-footer-disclaimer">
            <p>
              CollectiPay is a group contribution, democratic governance, and digital wallet
              platform. Dedicated virtual accounts, payment collections, and inter-bank transfers
              are powered in partnership with Flutterwave and licensed Nigerian financial
              institutions.
            </p>
          </div>

          <div className="cb-footer-bottom">
            <p>© {new Date().getFullYear()} CollectiPay. All rights reserved.</p>
            <p className="inline-flex items-center gap-1.5">
              <span>Built for transparent group finance in Nigeria</span>
              <NigeriaFlagIcon />
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
