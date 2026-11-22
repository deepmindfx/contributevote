import { useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  KeyRound,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
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
  const [transfersLocked, setTransfersLocked] = useState(false);

  return (
    <div className="cp-demo-app cp-demo-app--light">
      <div className="cp-demo-nav">
        <span className="cp-demo-back" aria-hidden="true">‹</span>
        <span className="cp-demo-nav-title">Manage your wallet</span>
        <span className="cp-demo-nav-badge">NGN</span>
      </div>

      {/* CollectiPay Deep-Emerald Signature Wallet Card */}
      <div className="cp-demo-wallet-card">
        <div className="cp-demo-wallet-top">
          <div className="cp-demo-wallet-brand">
            <img src="/collectipay-mark.svg" alt="" width={20} height={20} />
            <span>CollectiPay</span>
          </div>
          <span className="cp-demo-wallet-chip">
            <ShieldCheck size={10} aria-hidden="true" /> Verified
          </span>
        </div>

        <p className="cp-demo-wallet-label">Available balance</p>
        <p className="cp-demo-wallet-balance">₦245,500.00</p>

        <div className="cp-demo-wallet-meta">
          <span>Flutterwave MFB · •• 5281</span>
          <span className="cp-demo-wallet-free">3 free transfers</span>
        </div>
      </div>

      {/* Quick Action Strip */}
      <div className="cp-demo-quick-grid" aria-hidden="true">
        <div>
          <span><Plus size={12} /></span>
          <small>Add money</small>
        </div>
        <div>
          <span><Send size={11} /></span>
          <small>Send</small>
        </div>
        <div>
          <span><Users size={11} /></span>
          <small>Groups</small>
        </div>
        <div>
          <span><Vote size={11} /></span>
          <small>Votes</small>
        </div>
      </div>

      {/* PayPal-Style Crisp Control Rows */}
      <div className="cp-demo-rows">
        <div className="cp-demo-row">
          <span className="cp-demo-row-icon"><Lock size={13} /></span>
          <span className="cp-demo-row-text">
            <strong>Freeze outbound transfers</strong>
          </span>
          {interactive ? (
            <button
              type="button"
              role="switch"
              aria-checked={transfersLocked}
              aria-label="Toggle freeze outbound transfers preview"
              onClick={() => setTransfersLocked((v) => !v)}
              className={`cp-demo-switch ${transfersLocked ? "is-on" : ""}`}
            >
              <span />
            </button>
          ) : (
            <span className="cp-demo-switch" aria-hidden="true"><span /></span>
          )}
        </div>

        <div className="cp-demo-row">
          <span className="cp-demo-row-icon"><Building2 size={13} /></span>
          <span className="cp-demo-row-text">
            <strong>Dedicated deposit account</strong>
            <small>978 000 5281 · Instant credit</small>
          </span>
          <span className="cp-demo-pill">Active</span>
        </div>

        <div className="cp-demo-row">
          <span className="cp-demo-row-icon"><KeyRound size={13} /></span>
          <span className="cp-demo-row-text">
            <strong>4-Digit Transaction PIN</strong>
            <small>Protects transfers &amp; payouts</small>
          </span>
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
        </div>

        <div className="cp-demo-row">
          <span className="cp-demo-row-icon"><ArrowDownLeft size={13} /></span>
          <span className="cp-demo-row-text">
            <strong>Community Borehole Fund</strong>
            <small>₦420,000 pooled · 18 members</small>
          </span>
          <ArrowUpRight size={13} className="text-slate-400 shrink-0" />
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
