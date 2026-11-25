import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Compass,
  FileSpreadsheet,
  HeartHandshake,
  Lock,
  Menu,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Vote,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { CollectiPayMark } from "@/components/ui/BrandLoader";

interface LandingHeaderProps {
  isAuthenticated: boolean;
  startPath: string;
}

const PRODUCT_ITEMS = [
  {
    title: "Group Contribution Pools",
    badge: "Popular",
    badgeTone: "emerald",
    description: "Pool money for shared goals with live member ledgers and instant receipts.",
    href: "/discover",
    isRoute: true,
    icon: UsersRound,
    iconTone: "emerald",
  },
  {
    title: "Democratic Payout Voting",
    badge: "70% Quorum",
    badgeTone: "teal",
    description: "Require 70% participation and 60% approval before group funds move.",
    href: "#smart-experience",
    isRoute: false,
    icon: Vote,
    iconTone: "purple",
  },
  {
    title: "1-Tap Bank Transfers",
    badge: "Instant",
    badgeTone: "sky",
    description: "Send to any Nigerian bank with saved Recents, Favorites, and PIN protection.",
    href: "/transfer",
    isRoute: true,
    icon: Send,
    iconTone: "sky",
  },
  {
    title: "Bulk Payroll & Batch Payouts",
    badge: "CSV Ready",
    badgeTone: "violet",
    description: "Pay salaries and vendors in one verified batch authorized with a single PIN.",
    href: "#bulk-transfers",
    isRoute: false,
    icon: FileSpreadsheet,
    iconTone: "amber",
  },
  {
    title: "Ice Vault Fixed Savings",
    badge: "Discipline",
    badgeTone: "amber",
    description: "Lock personal target funds until your chosen maturity date with clear rules.",
    href: "/fixed-savings",
    isRoute: true,
    icon: Lock,
    iconTone: "rose",
  },
  {
    title: "Dedicated NGN Accounts",
    badge: "Flutterwave",
    badgeTone: "emerald",
    description: "Receive instant bank transfers directly into your wallet or group pool.",
    href: "#how-it-works",
    isRoute: false,
    icon: Building2,
    iconTone: "emerald",
  },
] as const;

const USE_CASE_ITEMS = [
  {
    title: "Mosques, Churches & Waqf",
    badge: "0% Fee",
    description: "Transparent faith and charity collections with zero CollectiPay withdrawal fee.",
    href: "#stories",
    icon: HeartHandshake,
    iconTone: "emerald",
  },
  {
    title: "Families & Ajo Circles",
    badge: "Shared Ledger",
    description: "Save for weddings, rent, and family milestones without screenshot chaos.",
    href: "#how-it-works",
    icon: UsersRound,
    iconTone: "amber",
  },
  {
    title: "SMEs & Team Payroll",
    badge: "Batch Pay",
    description: "Upload a payroll CSV and disburse verified salaries across Nigerian banks.",
    href: "#bulk-transfers",
    icon: FileSpreadsheet,
    iconTone: "sky",
  },
  {
    title: "Startups, Alumni & Makers",
    badge: "Milestone Vote",
    description: "Back community projects and release funds only when contributors vote yes.",
    href: "#why-collectipay",
    icon: ShieldCheck,
    iconTone: "purple",
  },
] as const;

type OpenMenu = "products" | "use-cases" | null;

export function LandingHeader({ isAuthenticated, startPath }: LandingHeaderProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenMenu(null);
    }, 140);
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearCloseTimer();
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const closeAll = () => {
    setOpenMenu(null);
    setMobileOpen(false);
  };

  return (
    <header className="cb-header">
      <div className="cb-container cb-header-inner" ref={navRef}>
        {/* Zone 1: Brand Wordmark */}
        <div className="cb-header-brand-wrap">
          <Link to="/" className="cb-brand" onClick={closeAll}>
            <CollectiPayMark size={32} />
            <span className="cb-brand-name">
              collectipay<sup aria-hidden="true">®</sup>
            </span>
          </Link>
        </div>

        {/* Zone 2: Center Navigation + Cashbuddy-style Glassmorphic Mega-Dropdowns */}
        <nav className="cb-nav" aria-label="Main navigation">
          {/* Products & Services Mega-Menu */}
          <div
            className="cb-nav-dropdown"
            onMouseEnter={() => {
              clearCloseTimer();
              setOpenMenu("products");
            }}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              className="cb-nav-link"
              aria-expanded={openMenu === "products"}
              data-open={openMenu === "products"}
              onClick={() => setOpenMenu((cur) => (cur === "products" ? null : "products"))}
            >
              <span>Products &amp; Services</span>
              <ChevronDown size={15} className="cb-nav-chevron" aria-hidden="true" />
            </button>

            {openMenu === "products" && (
              <div className="cb-mega-panel cb-mega-panel--wide" role="menu">
                {PRODUCT_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const content = (
                    <>
                      <span className={`cb-mega-icon cb-mega-icon--${item.iconTone}`} aria-hidden="true">
                        <Icon size={18} strokeWidth={2} />
                      </span>
                      <span className="cb-mega-body">
                        <span className="cb-mega-title-row">
                          <strong>{item.title}</strong>
                          <em className={`cb-mega-badge cb-mega-badge--${item.badgeTone}`}>
                            {item.badge}
                          </em>
                        </span>
                        <small>{item.description}</small>
                      </span>
                    </>
                  );

                  return item.isRoute ? (
                    <Link
                      key={item.title}
                      to={item.href}
                      role="menuitem"
                      className="cb-mega-item"
                      onClick={closeAll}
                    >
                      {content}
                    </Link>
                  ) : (
                    <a
                      key={item.title}
                      href={item.href}
                      role="menuitem"
                      className="cb-mega-item"
                      onClick={closeAll}
                    >
                      {content}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Use Cases Mega-Menu */}
          <div
            className="cb-nav-dropdown"
            onMouseEnter={() => {
              clearCloseTimer();
              setOpenMenu("use-cases");
            }}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              className="cb-nav-link"
              aria-expanded={openMenu === "use-cases"}
              data-open={openMenu === "use-cases"}
              onClick={() => setOpenMenu((cur) => (cur === "use-cases" ? null : "use-cases"))}
            >
              <span>Use Cases</span>
              <ChevronDown size={15} className="cb-nav-chevron" aria-hidden="true" />
            </button>

            {openMenu === "use-cases" && (
              <div className="cb-mega-panel cb-mega-panel--medium" role="menu">
                {USE_CASE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.title}
                      href={item.href}
                      role="menuitem"
                      className="cb-mega-item"
                      onClick={closeAll}
                    >
                      <span className={`cb-mega-icon cb-mega-icon--${item.iconTone}`} aria-hidden="true">
                        <Icon size={18} strokeWidth={2} />
                      </span>
                      <span className="cb-mega-body">
                        <span className="cb-mega-title-row">
                          <strong>{item.title}</strong>
                          <em className="cb-mega-badge cb-mega-badge--emerald">{item.badge}</em>
                        </span>
                        <small>{item.description}</small>
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <a href="#smart-experience" className="cb-nav-link" onClick={closeAll}>
            App Preview
          </a>
          <a href="#pricing" className="cb-nav-link" onClick={closeAll}>
            Pricing
          </a>
          <a href="#faq" className="cb-nav-link" onClick={closeAll}>
            FAQ
          </a>
          <Link to="/discover" className="cb-nav-link" onClick={closeAll}>
            Discover
          </Link>
        </nav>

        {/* Zone 3: Auth & Launch App CTAs */}
        <div className="cb-header-actions">
          <Link
            to={isAuthenticated ? "/dashboard" : "/auth"}
            className="cb-header-signin"
            onClick={closeAll}
          >
            {isAuthenticated ? "Dashboard" : "Sign In"}
          </Link>

          <Link
            to={isAuthenticated ? "/dashboard" : startPath}
            className="cb-header-launch"
            onClick={closeAll}
          >
            <span>{isAuthenticated ? "Open App" : "Launch App"}</span>
            <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
          </Link>

          <button
            type="button"
            className="cb-mobile-toggle"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {/* Mobile Glassmorphic Menu Drawer */}
      {mobileOpen && (
        <div className="cb-mobile-drawer">
          <div className="cb-container cb-mobile-drawer-inner">
            <div className="cb-mobile-section">
              <p className="cb-mobile-kicker">
                <Sparkles size={12} aria-hidden="true" /> Products &amp; Features
              </p>
              <div className="cb-mobile-grid">
                {PRODUCT_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return item.isRoute ? (
                    <Link
                      key={item.title}
                      to={item.href}
                      className="cb-mobile-card"
                      onClick={closeAll}
                    >
                      <span className={`cb-mega-icon cb-mega-icon--${item.iconTone}`} aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.badge}</small>
                      </div>
                    </Link>
                  ) : (
                    <a
                      key={item.title}
                      href={item.href}
                      className="cb-mobile-card"
                      onClick={closeAll}
                    >
                      <span className={`cb-mega-icon cb-mega-icon--${item.iconTone}`} aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.badge}</small>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="cb-mobile-links">
              <Link to="/discover" onClick={closeAll}>
                <Compass size={16} aria-hidden="true" /> Discover Public Groups
              </Link>
              <a href="#smart-experience" onClick={closeAll}>
                Pool, Send &amp; Save Smarter
              </a>
              <a href="#why-collectipay" onClick={closeAll}>
                Why CollectiPay
              </a>
              <a href="#pricing" onClick={closeAll}>
                Pricing &amp; 0% Charity Fees
              </a>
              <a href="#faq" onClick={closeAll}>
                Frequently Asked Questions
              </a>
            </div>

            <div className="cb-mobile-cta-row">
              <Link
                to={isAuthenticated ? "/dashboard" : "/auth"}
                className="cb-btn cb-btn--ghost cb-mobile-btn"
                onClick={closeAll}
              >
                {isAuthenticated ? "Dashboard" : "Sign In"}
              </Link>
              <Link
                to={isAuthenticated ? "/dashboard" : startPath}
                className="cb-btn cb-btn--primary cb-mobile-btn"
                onClick={closeAll}
              >
                <span>{isAuthenticated ? "Open App" : "Launch App"}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
