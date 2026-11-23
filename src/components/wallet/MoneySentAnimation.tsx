import { useEffect, useRef } from "react";
import { Building2, Check, Clock3, Users, Wallet, X } from "lucide-react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { cn } from "@/lib/utils";
import { paymentVibrationEnabled } from "@/services/supabase/notificationService";
import "./money-sent.css";

interface MoneySentAnimationProps {
  status: "sent" | "processing" | "failed";
  amount: number;
  recipientName: string;
  recipientSubline?: string;
  variant?: "transfer" | "contribution";
  compact?: boolean;
}

const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
});

const transferStatus = {
  sent: { title: "Transfer complete", milestone: "Bank confirmed", Icon: Check },
  processing: { title: "Transfer processing", milestone: "Awaiting bank", Icon: Clock3 },
  failed: { title: "Transfer failed", milestone: "Failed", Icon: X },
};

export function MoneySentAnimation({ status, amount, recipientName, recipientSubline, variant = "transfer", compact = false }: MoneySentAnimationProps) {
  const { user } = useSupabaseUser();
  const vibrationEnabled = paymentVibrationEnabled(user?.preferences);
  const hasVibrated = useRef(false);
  const { Icon, title, milestone } = transferStatus[status];
  const isContribution = variant === "contribution";
  const DestinationIcon = isContribution ? Users : Building2;

  useEffect(() => {
    if (status !== "sent") {
      hasVibrated.current = false;
    } else if (vibrationEnabled && !hasVibrated.current && typeof navigator.vibrate === "function") {
      hasVibrated.current = true;
      try { navigator.vibrate(35); } catch { /* Haptics may be blocked by the browser. */ }
    }
  }, [status, vibrationEnabled]);

  return (
    <section className={cn("cp-money-stage", `cp-money-stage--${status}`, compact && "cp-money-stage--compact")}>
      <div className="cp-money-summary" aria-live="polite" aria-atomic="true">
        <div className="min-w-0">
          <h2 className="cp-money-title">{isContribution && status === "sent" ? "Contribution confirmed" : title}</h2>
          <p className="cp-money-amount tabular-nums">{ngn.format(Number.isFinite(amount) ? amount : 0)}</p>
        </div>
        {isContribution && <span className="cp-money-status-icon" key={status} aria-hidden="true"><Icon size={23} strokeWidth={2} /></span>}
      </div>

      {!isContribution && <div className="cp-money-timeline" role="group" aria-label="Transfer progress">
        <div className="cp-money-rail" aria-hidden="true">
          <span className="cp-money-node cp-money-node--wallet"><Wallet size={19} strokeWidth={1.75} /></span>
          <span className="cp-money-track">
            <span className="cp-money-track-fill" />
            <span className="cp-money-signal" />
          </span>
          <span className="cp-money-node cp-money-node--bank">
            <Building2 size={19} strokeWidth={1.75} />
            <span key={status} className="cp-money-terminal-mark"><Icon size={11} strokeWidth={2.3} /></span>
          </span>
        </div>
        <div className="cp-money-timeline-labels"><span>From wallet</span><span>{milestone}</span></div>
      </div>}

      <div className="cp-money-recipient">
        <div className="cp-money-destination" aria-hidden="true"><DestinationIcon size={18} strokeWidth={1.7} /></div>
        <dl className="min-w-0">
          <dt className="sr-only">{isContribution ? "Group" : "Recipient"}</dt>
          <dd className="cp-money-recipient-name" dir="auto">{recipientName}</dd>
          {recipientSubline && <dd className="cp-money-recipient-sub">{recipientSubline}</dd>}
        </dl>
      </div>

    </section>
  );
}
