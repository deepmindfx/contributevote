import { ArrowDownLeft, ArrowLeftRight, Bell, Building2, Clock, Home, Plus, SendHorizontal, UserRound, Users, Vote, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { CommunityStoriesSection } from "@/components/landing/CommunityStoriesSection";
import "@/styles/landing.css";

const steps = [
  { icon: Users, title: "Start a group", description: "Pick a goal for your event, savings circle, or community project. Make it public or invite people privately." },
  { icon: Wallet, title: "Contribute together", description: "Use your CollectiPay wallet or the group’s dedicated bank account. Everyone can follow the progress." },
  { icon: Vote, title: "Have a say", description: "Turn on voting so eligible contributors can decide together on withdrawals and refunds." },
];

function ProductPreview() {
  return (
    <figure className="landing-preview" aria-label="CollectiPay dashboard preview with example balances and a group savings goal">
      <div className="landing-phone" aria-hidden="true">
        <div className="landing-phone-top">
          <span className="landing-demo-avatar">AO</span>
          <div><strong>Hi, Amara</strong><small>CollectiPay</small></div>
          <span className="landing-demo-bell"><Bell size={14} /></span>
        </div>
        <div className="landing-demo-wallet">
          <div className="landing-demo-balance-meta">
            <span>Available balance</span>
            <div><strong>₦ NGN</strong><span>$ USD</span></div>
          </div>
          <strong>₦75,000.00</strong>
        </div>
        <div className="landing-phone-body">
          <div className="landing-demo-section"><strong>Quick actions</strong></div>
          <div className="landing-demo-actions">
            <span><Plus size={14} /> Add money</span>
            <span><SendHorizontal size={14} /> Send</span>
            <span><Building2 size={14} /> Bank</span>
            <span><Clock size={14} /> History</span>
          </div>
          <div className="landing-demo-section"><strong>My groups</strong><span>View all</span></div>
          <div className="landing-demo-group">
            <div className="landing-demo-group-name">
              <span><Users size={17} /></span>
              <div><strong>Community fund</strong><small>Group savings</small></div>
            </div>
            <div className="landing-demo-progress"><span /></div>
            <div className="landing-demo-amount"><strong>₦150,000 raised</strong><span>75%</span></div>
          </div>
          <div className="landing-demo-section"><strong>Recent activity</strong></div>
          <div className="landing-demo-activity">
            <ArrowDownLeft size={17} /><span>Wallet top-up</span><strong>+₦25,000</strong>
          </div>
        </div>
        <div className="landing-demo-nav">
          <span><Home size={15} /> Home</span>
          <span><Users size={15} /> Groups</span>
          <span><span className="landing-demo-action-icon"><ArrowLeftRight size={14} /></span> Move money</span>
          <span><Vote size={15} /> Votes</span>
          <span><UserRound size={15} /> Account</span>
        </div>
      </div>
      <figcaption>Example dashboard</figcaption>
    </figure>
  );
}

export default function Index() {
  const { isAuthenticated } = useSupabaseUser();
  const startPath = isAuthenticated ? "/create-group" : "/auth?mode=signup";

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-width">
          <Link to="/" className="landing-brand"><CollectiPayMark size={34} /> CollectiPay</Link>
          <nav aria-label="Main navigation">
            <a href="#stories" className="landing-nav-detail">Stories</a>
            <a href="#how-it-works" className="landing-nav-detail">How it works</a>
            <Link to="/discover" className="landing-nav-detail">Discover</Link>
            <Link to={isAuthenticated ? "/dashboard" : "/auth"} className="landing-sign-in">
              {isAuthenticated ? "Dashboard" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero landing-width" aria-labelledby="landing-title">
          <div className="landing-intro">
            <h1 id="landing-title">Save as a group.<br /><span>Decide together.</span></h1>
            <p>Bring your wallet, group contributions, and withdrawal votes together in one place.</p>
            <div className="landing-actions">
              <Link to={startPath} className="landing-button landing-button-primary">{isAuthenticated ? "Create a group" : "Create an account"}</Link>
              <Link to="/discover" className="landing-button landing-button-secondary">Explore groups</Link>
            </div>
          </div>
          <ProductPreview />
        </section>

        <CommunityStoriesSection startPath={startPath} />

        <section id="how-it-works" className="landing-how">
          <div className="landing-width">
            <div className="landing-section-heading">
              <h2>From a shared goal to a funded one.</h2>
              <p>Bring people, payments, and group decisions into one place.</p>
            </div>
            <ol className="landing-steps">
              {steps.map(({ icon: Icon, title, description }) => (
                <li key={title}>
                  <span className="landing-step-icon"><Icon size={23} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
            <div className="landing-end">
              <div>
                <h2>What are you saving for?</h2>
                <p>Give your group a place to make it happen.</p>
              </div>
              <Link to={startPath} className="landing-button landing-button-primary">{isAuthenticated ? "Create a group" : "Get started"}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-width">
          <Link to="/" className="landing-brand"><CollectiPayMark size={34} /> CollectiPay</Link>
          <span>Payments powered by Flutterwave</span>
          <Link to="/discover">Discover groups</Link>
        </div>
      </footer>
    </div>
  );
}
