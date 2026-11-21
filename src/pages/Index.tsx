import { ArrowDownLeft, Bell, Compass, Home, Plus, SendHorizontal, Users, Vote, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import "@/styles/landing.css";

const logo = "/lovable-uploads/91e5c361-b912-4a7e-bcf3-4602a512cb51.png";
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
          <span><img src={logo} alt="" /> CollectiPay</span>
          <Bell size={15} />
        </div>
        <div className="landing-phone-body">
          <p className="landing-demo-greeting">Hi, Amara</p>
          <div className="landing-demo-wallet">
            <span>Available balance</span>
            <strong>₦75,000.00</strong>
            <div className="landing-demo-actions">
              <span><Plus size={13} /> Add money</span>
              <span><SendHorizontal size={12} /> Send</span>
            </div>
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
          <span><Compass size={15} /> Discover</span>
          <span><Vote size={15} /> Votes</span>
          <span><Users size={15} /> Groups</span>
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
          <Link to="/" className="landing-brand"><img src={logo} alt="" /> CollectiPay</Link>
          <nav aria-label="Main navigation">
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
            <h1 id="landing-title">Save together.<br /><span>Decide together.</span></h1>
            <p>Collect money for a shared goal, track every contribution, and give members a say in how group funds are used.</p>
            <div className="landing-actions">
              <Link to={startPath} className="landing-button landing-button-primary">{isAuthenticated ? "Create a group" : "Open an account"}</Link>
              <Link to="/discover" className="landing-button landing-button-secondary">Explore groups</Link>
            </div>
          </div>
          <ProductPreview />
        </section>

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
          <Link to="/" className="landing-brand"><img src={logo} alt="" /> CollectiPay</Link>
          <span>Payments powered by Flutterwave</span>
          <Link to="/discover">Discover groups</Link>
        </div>
      </footer>
    </div>
  );
}
