import { useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Home,
  Plus,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  UserRound,
  Users,
  Vote,
  Wifi,
} from "lucide-react";

export type PhoneDemoScreen = "wallet" | "transfer" | "vote";

interface IPhone18ProMaxMockupProps {
  screen: PhoneDemoScreen;
  className?: string;
  compact?: boolean;
  interactive?: boolean;
}

function IPhoneFrame({
  children,
  className = "",
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`cp-iphone18 ${compact ? "cp-iphone18--compact" : ""} ${className}`}
      role="img"
      aria-label="CollectiPay app preview on iPhone 18 Pro Max"
    >
      {/* Titanium hardware side buttons */}
      <span className="cp-iphone18-btn cp-iphone18-btn--action" aria-hidden="true" />
      <span className="cp-iphone18-btn cp-iphone18-btn--vol-up" aria-hidden="true" />
      <span className="cp-iphone18-btn cp-iphone18-btn--vol-down" aria-hidden="true" />
      <span className="cp-iphone18-btn cp-iphone18-btn--power" aria-hidden="true" />
      <span className="cp-iphone18-btn cp-iphone18-btn--camera" aria-hidden="true" />

      {/* Outer brushed titanium chassis & ultra-thin Pro Max bezel */}
      <div className="cp-iphone18-bezel">
        <div className="cp-iphone18-screen">
          {/* iOS Status Bar + Compact iPhone 18 Pro Max Dynamic Island */}
          <div className="cp-iphone18-statusbar" aria-hidden="true">
            <span className="cp-iphone18-time">9:41</span>
            <span className="cp-iphone18-island">
              <span className="cp-iphone18-camera-lens" />
            </span>
            <span className="cp-iphone18-signals">
              <span className="cp-iphone18-bars">
                <i />
                <i />
                <i />
                <i />
              </span>
              <Wifi size={10} strokeWidth={2.5} />
              <span className="cp-iphone18-battery">
                <span />
              </span>
            </span>
          </div>

          {/* Live App Content */}
          <div className="cp-iphone18-content">{children}</div>

          {/* Home Indicator */}
          <div className="cp-iphone18-homebar" aria-hidden="true" />

          {/* Subtle curved glass specular reflection */}
          <div className="cp-iphone18-sheen" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function WalletAppScreen({ interactive = true }: { interactive?: boolean }) {
  const [showBalance, setShowBalance] = useState(true);
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const formattedBalance =
    currency === "NGN" ? "₦245,500.00" : "$158.39";

  return (
    <div className="cp-demo-app cp-demo-app--dashboard">
      {/* Authentic CollectiPay Mobile Wallet Header (.app-header-wallet + .wallet-overview) */}
      <div className="cp-real-wallet-hero">
        <div className="cp-real-header">
          <span className="cp-real-avatar" aria-hidden="true">
            <span>AW</span>
          </span>
          <div className="cp-real-greeting">
            <strong>Hi, Aliyu</strong>
            <span>CollectiPay</span>
          </div>
          <span className="cp-real-bell" aria-hidden="true">
            <Bell size={13} />
            <i />
          </span>
        </div>

        <div className="cp-real-balance-row">
          <div className="cp-real-balance-label">
            <span>Available balance</span>
            {interactive ? (
              <button
                type="button"
                onClick={() => setShowBalance((v) => !v)}
                aria-label={showBalance ? "Hide balance preview" : "Show balance preview"}
                className="cp-real-eye-btn"
              >
                {showBalance ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            ) : (
              <span className="cp-real-eye-btn" aria-hidden="true">
                <EyeOff size={12} />
              </span>
            )}
          </div>

          <div className="cp-real-currency" role="group" aria-label="Currency preview">
            <button
              type="button"
              disabled={!interactive}
              data-active={currency === "NGN"}
              onClick={() => setCurrency("NGN")}
            >
              NGN
            </button>
            <button
              type="button"
              disabled={!interactive}
              data-active={currency === "USD"}
              onClick={() => setCurrency("USD")}
            >
              USD
            </button>
          </div>
        </div>

        <p className="cp-real-balance-amount">
          {showBalance ? formattedBalance : `${currency === "NGN" ? "₦" : "$"}•••••••`}
        </p>
      </div>

      {/* Overlapping Rounded Dashboard Sheet (.dashboard-wallet-content) */}
      <div className="cp-real-sheet">
        <p className="cp-real-section-title">Quick actions</p>
        <div className="cp-real-quick-card" aria-hidden="true">
          <div className="cp-real-quick-item is-primary">
            <span><Plus size={13} strokeWidth={2.4} /></span>
            <small>Add money</small>
          </div>
          <div className="cp-real-quick-item">
            <span><SendHorizontal size={12} /></span>
            <small>Send</small>
          </div>
          <div className="cp-real-quick-item">
            <span><Building2 size={12} /></span>
            <small>Bank account</small>
          </div>
          <div className="cp-real-quick-item">
            <span><Clock size={12} /></span>
            <small>History</small>
          </div>
        </div>

        {/* TransferAllowanceNotice */}
        <div className="cp-real-allowance">
          <CalendarDays size={13} className="shrink-0 text-[#156a4a] mt-0.5" aria-hidden="true" />
          <div>
            <strong>3 free bank transfers left today</strong>
            <small>Free every Friday. Fees apply after your daily allowance.</small>
          </div>
        </div>

        {/* My groups (GroupsList.tsx) */}
        <div className="cp-real-groups-head">
          <span className="cp-real-section-title">My groups</span>
          <span className="cp-real-view-all">
            View all <ChevronRight size={11} />
          </span>
        </div>

        <div className="cp-real-groups-card">
          <div className="cp-real-group-item">
            <div className="cp-real-group-top">
              <span className="cp-real-group-icon"><Users size={12} /></span>
              <div className="cp-real-group-meta">
                <strong>Community Borehole Fund</strong>
                <small>24 members</small>
              </div>
              <ChevronRight size={12} className="text-slate-400 shrink-0" />
            </div>
            <div className="cp-real-progress">
              <span style={{ width: "78%" }} />
            </div>
            <div className="cp-real-group-foot">
              <span><strong>₦327,600</strong> of ₦420,000</span>
              <em>78% funded</em>
            </div>
          </div>

          <div className="cp-real-group-item">
            <div className="cp-real-group-top">
              <span className="cp-real-group-icon"><Users size={12} /></span>
              <div className="cp-real-group-meta">
                <strong>Kano Tech Hub Solar Pool</strong>
                <small>18 members</small>
              </div>
              <ChevronRight size={12} className="text-slate-400 shrink-0" />
            </div>
            <div className="cp-real-progress">
              <span style={{ width: "92%" }} />
            </div>
            <div className="cp-real-group-foot">
              <span><strong>₦184,000</strong> of ₦200,000</span>
              <em>92% funded</em>
            </div>
          </div>
        </div>
      </div>

      {/* Authentic 5-Column Mobile Bottom Tabbar (.app-tabbar) */}
      <div className="cp-real-tabbar" aria-hidden="true">
        <div className="cp-real-tab is-active">
          <span className="cp-real-tab-pill"><Home size={12} /></span>
          <small>Home</small>
        </div>
        <div className="cp-real-tab">
          <span className="cp-real-tab-pill"><Users size={12} /></span>
          <small>Groups</small>
        </div>
        <div className="cp-real-tab cp-real-tab--fab">
          <span className="cp-real-fab"><ArrowLeftRight size={13} strokeWidth={2.3} /></span>
          <small>Move money</small>
        </div>
        <div className="cp-real-tab">
          <span className="cp-real-tab-pill">
            <Vote size={12} />
            <i>2</i>
          </span>
          <small>Votes</small>
        </div>
        <div className="cp-real-tab">
          <span className="cp-real-tab-pill"><UserRound size={12} /></span>
          <small>Account</small>
        </div>
      </div>
    </div>
  );
}

function TransferAppScreen() {
  return (
    <div className="cp-demo-app cp-demo-app--light">
      <div className="cp-demo-nav">
        <span className="cp-demo-back" aria-hidden="true">‹</span>
        <span className="cp-demo-nav-title">Transfer to bank</span>
        <span className="cp-demo-nav-link">History</span>
      </div>

      {/* Live Mini Money Sent Flight Card */}
      <div className="cp-demo-sent-card">
        <span className="cp-demo-sent-badge">
          <Sparkles size={9} aria-hidden="true" /> Delivered by CollectiPay
        </span>
        <div className="cp-demo-sent-arc" aria-hidden="true">
          <span className="cp-demo-sent-node">₦</span>
          <span className="cp-demo-sent-line" />
          <span className="cp-demo-sent-seal">
            <Check size={13} strokeWidth={3} />
          </span>
          <span className="cp-demo-sent-line" />
          <span className="cp-demo-sent-node cp-demo-sent-node--bank">OP</span>
        </div>
        <p className="cp-demo-sent-amount">₦25,000.00</p>
        <p className="cp-demo-sent-to">Usman Salisu · OPay</p>
      </div>

      {/* 1-Tap Recent Beneficiaries */}
      <div className="cp-demo-beneficiaries">
        <div className="cp-demo-ben-head">
          <span className="is-active">Recents</span>
          <span>Favorites</span>
        </div>

        <div className="cp-demo-ben-row">
          <span className="cp-demo-monogram" style={{ background: "#1A56DB", color: "#fff" }}>MP</span>
          <div className="cp-demo-ben-info">
            <div className="cp-demo-ben-title">
              <strong>Aliyu Wada</strong>
              <span className="cp-demo-own-pill">Own</span>
            </div>
            <small>906 341 2927 · Moniepoint</small>
          </div>
          <span className="cp-demo-chevron">›</span>
        </div>

        <div className="cp-demo-ben-row">
          <span className="cp-demo-monogram" style={{ background: "#00B876", color: "#fff" }}>OP</span>
          <div className="cp-demo-ben-info">
            <div className="cp-demo-ben-title">
              <strong>Usman Salisu</strong>
            </div>
            <small>706 365 7261 · OPay</small>
          </div>
          <span className="cp-demo-chevron">›</span>
        </div>

        <div className="cp-demo-ben-row">
          <span className="cp-demo-monogram" style={{ background: "#DD4F05", color: "#fff" }}>GT</span>
          <div className="cp-demo-ben-info">
            <div className="cp-demo-ben-title">
              <strong>Salima Bello</strong>
            </div>
            <small>014 882 9014 · GTBank</small>
          </div>
          <span className="cp-demo-chevron">›</span>
        </div>
      </div>
    </div>
  );
}

function VoteAppScreen({ interactive = true }: { interactive?: boolean }) {
  const [voted, setVoted] = useState(false);
  const votersCount = voted ? 16 : 15;
  const participationPct = Math.round((votersCount / 18) * 100);
  const approvalPct = voted ? 94 : 93;

  return (
    <div className="cp-demo-app cp-demo-app--light">
      <div className="cp-demo-nav">
        <span className="cp-demo-back" aria-hidden="true">‹</span>
        <span className="cp-demo-nav-title">Governance vote</span>
        <span className="cp-demo-nav-badge">Open</span>
      </div>

      <div className="cp-demo-vote-hero">
        <span className="cp-demo-vote-rule">
          <ShieldCheck size={10} aria-hidden="true" /> 70% Must Vote · 60% Yes to Pass
        </span>
        <p className="cp-demo-vote-group">Community Borehole Fund</p>
        <p className="cp-demo-vote-amount">₦420,000</p>
        <p className="cp-demo-vote-purpose">Pump installation &amp; solar inverter deposit</p>
      </div>

      <div className="cp-demo-vote-meters">
        <div className="cp-demo-meter">
          <div className="cp-demo-meter-top">
            <span>Participation ({votersCount}/18)</span>
            <strong>{participationPct}%</strong>
          </div>
          <div className="cp-demo-meter-bar">
            <span style={{ width: `${participationPct}%` }} />
          </div>
        </div>

        <div className="cp-demo-meter">
          <div className="cp-demo-meter-top">
            <span>Yes approvals</span>
            <strong>{approvalPct}%</strong>
          </div>
          <div className="cp-demo-meter-bar">
            <span style={{ width: `${approvalPct}%` }} />
          </div>
        </div>
      </div>

      {interactive ? (
        voted ? (
          <div className="cp-demo-voted-pill">
            <CheckCircle2 size={13} /> You voted to Approve
          </div>
        ) : (
          <div className="cp-demo-vote-actions">
            <button
              type="button"
              className="cp-demo-btn-approve"
              onClick={() => setVoted(true)}
            >
              <ThumbsUp size={11} /> Approve
            </button>
            <button
              type="button"
              className="cp-demo-btn-reject"
              onClick={() => setVoted(true)}
            >
              Reject
            </button>
          </div>
        )
      ) : (
        <div className="cp-demo-voted-pill">
          <CheckCircle2 size={13} /> Auto-payout when threshold met
        </div>
      )}
    </div>
  );
}

export function IPhone18ProMaxMockup({
  screen,
  className = "",
  compact = false,
  interactive = true,
}: IPhone18ProMaxMockupProps) {
  return (
    <IPhoneFrame className={className} compact={compact}>
      {screen === "wallet" ? (
        <WalletAppScreen interactive={interactive} />
      ) : screen === "transfer" ? (
        <TransferAppScreen />
      ) : (
        <VoteAppScreen interactive={interactive} />
      )}
    </IPhoneFrame>
  );
}
