import { useEffect, useRef } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, HeartHandshake, UsersRound, Vote, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { CommunityStoriesSection } from "@/components/landing/CommunityStoriesSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { SmartShowcaseSection } from "@/components/landing/SmartShowcaseSection";
import "@/styles/landing.css";

const steps = [
  {
    icon: UsersRound, title: "Bring your group together",
    description: "Set a savings goal and write your group rules. Share a private invite or let people discover your public group.",
  },
  {
    icon: WalletCards, title: "Collect in one place",
    description: "Contribute from your wallet, pay by card or bank, and follow the group’s progress as payments come in.",
  },
  {
    icon: Vote, title: "Decide together",
    description: "Enable voting so eligible contributors can approve withdrawals and refunds before the money moves.",
  },
];

const comparisons = [
  { feature: "Joining", manual: "Rules and invitations scattered across chats", product: "Private invite links and group rules you can review before joining" },
  { feature: "Payments", manual: "Transfers and screenshots to reconcile", product: "In-app payments recorded automatically and confirmed outside transfers matched by an admin" },
  { feature: "Record keeping", manual: "Spreadsheets to update by hand", product: "Group activity, individual receipts, and monthly insights for owners" },
  { feature: "Withdrawals", manual: "Approvals discussed in messages", product: "Recorded votes from eligible contributors when group voting is enabled" },
  { feature: "Sending money", manual: "Payment details confirmed across apps", product: "Verify bank recipient details and authorize wallet transfers with a PIN" },
];

const sectionLinks = [
  { href: "#how-it-works", text: "How it works" },
  { href: "#why-collectipay", text: "Why CollectiPay" },
  { href: "#pricing", text: "Pricing" },
  { href: "#faq", text: "FAQ" },
];

function GroupPhoto() {
  return (
    <figure className="landing-hero-photo">
      <img
        src="/images/collectipay-together.webp"
        srcSet="/images/collectipay-together-small.webp 720w, /images/collectipay-together.webp 1536w"
        sizes="(min-width: 64rem) 46vw, 100vw"
        width={1536}
        height={1024}
        alt="Three friends planning a shared project together"
        fetchPriority="high"
      />
      <figcaption className="landing-pool-preview">
        <div className="landing-pool-meta">
          <span className="landing-pool-icon"><ArrowDownLeft size={18} aria-hidden="true" /></span>
          <div><span>Example group</span><strong>Community fund</strong></div>
        </div>
        <div className="landing-pool-raised"><strong>₦150,000</strong><span>75% funded</span></div>
        <div className="landing-pool-progress" aria-hidden="true"><span /></div>
      </figcaption>
    </figure>
  );
}

export default function Index() {
  const { isAuthenticated } = useSupabaseUser();
  const startPath = isAuthenticated ? "/create-group" : "/auth?mode=signup";
  const startLabel = isAuthenticated ? "Create a group" : "Get started";
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-revealed", "");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    main.querySelectorAll("[data-scroll-reveal]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing">
      <a href="#landing-main" className="landing-skip">Skip to content</a>
      <header className="landing-header">
        <div className="landing-width">
          <Link to="/" className="landing-brand"><CollectiPayMark size={35} /> CollectiPay</Link>
          <nav className="landing-main-nav" aria-label="Main navigation">
            {sectionLinks.map(({ href, text }) => <a key={href} href={href}>{text}</a>)}
            <Link to="/discover">Discover groups</Link>
          </nav>
          <div className="landing-header-actions">
            <Link to="/discover" className="landing-mobile-discover">Discover</Link>
            <Link to={isAuthenticated ? "/dashboard" : "/auth"} className="landing-button landing-button-secondary">
              {isAuthenticated ? "Dashboard" : "Sign in"}
            </Link>
            {!isAuthenticated && <Link to={startPath} className="landing-button landing-button-primary landing-header-start">Sign up</Link>}
          </div>
        </div>
      </header>

      <main id="landing-main" ref={mainRef} tabIndex={-1}>
        <section className="landing-hero landing-width" aria-labelledby="landing-title">
          <div className="landing-intro">
            <h1 id="landing-title">Save together.<span>Decide together.</span></h1>
            <p>Collect money for a shared goal, track every contribution, and give eligible members a say in how the money is used.</p>
            <div className="landing-actions">
              <Link to={startPath} className="landing-button landing-button-primary">{startLabel}<ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link to="/discover" className="landing-text-link">Explore groups <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
          <GroupPhoto />
        </section>

        <section id="how-it-works" className="landing-how" aria-labelledby="how-title">
          <div className="landing-width">
            <div className="landing-section-heading" data-scroll-reveal>
              <h2 id="how-title">One place to run<br className="landing-heading-break" /> a group fund.</h2>
              <p>For savings circles, community projects, and the plans you’re making together.</p>
            </div>
            <div className="landing-steps">
              {steps.map(({ icon: Icon, title, description }) => (
                <article key={title} data-scroll-reveal>
                  <span className="landing-step-icon"><Icon size={26} strokeWidth={1.7} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <SmartShowcaseSection />

        <section id="why-collectipay" className="landing-why landing-width" aria-labelledby="why-title">
          <div className="landing-section-heading" data-scroll-reveal>
            <h2 id="why-title">Why CollectiPay?</h2>
            <p>Keep payments, records, and decisions where your group can follow them.</p>
          </div>
          <table className="landing-compare" aria-labelledby="why-title" data-scroll-reveal>
            <thead>
              <tr><th scope="col">What you manage</th><th scope="col">Manual groups</th><th scope="col">With CollectiPay</th></tr>
            </thead>
            <tbody>
              {comparisons.map(({ feature, manual, product }) => (
                <tr key={feature}>
                  <th scope="row">{feature}</th>
                  <td><span className="landing-compare-mobile-label" aria-hidden="true">Manual groups</span>{manual}</td>
                  <td>
                    <span className="landing-compare-mobile-label" aria-hidden="true">CollectiPay</span>
                    <span className="landing-compare-benefit"><Check size={16} aria-hidden="true" />{product}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="pricing" className="landing-pricing" aria-labelledby="pricing-title">
          <div className="landing-width">
            <div className="landing-section-heading" data-scroll-reveal>
              <h2 id="pricing-title">Simple, transparent group fees.</h2>
              <p>See the fee and the net payout before confirming a withdrawal.</p>
            </div>
            <dl className="landing-prices" data-scroll-reveal>
              <div>
                <dt><WalletCards size={21} aria-hidden="true" /> Group withdrawals</dt>
                <dd>A percentage of the amount withdrawn</dd>
              </div>
              <div>
                <dt><HeartHandshake size={21} aria-hidden="true" /> Charity group withdrawals</dt>
                <dd>No CollectiPay withdrawal fee</dd>
              </div>
            </dl>
          </div>
        </section>

        <CommunityStoriesSection />

        <FaqSection />

        <section className="landing-end landing-width" aria-labelledby="start-title" data-scroll-reveal>
          <h2 id="start-title">What are you saving for?</h2>
          <Link to={startPath} className="landing-button landing-button-primary">{startLabel}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-width">
          <Link to="/" className="landing-brand"><CollectiPayMark size={32} /> CollectiPay</Link>
          <nav aria-label="Footer navigation">
            {sectionLinks.map(({ href, text }) => <a key={href} href={href}>{text}</a>)}
            <Link to="/discover">Discover groups</Link>
          </nav>
          <p>Payments powered by Flutterwave</p>
        </div>
      </footer>
    </div>
  );
}
