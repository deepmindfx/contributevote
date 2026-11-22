import { useEffect, useState } from "react";
import { Building2, Check, Clock3, ShieldAlert, Sparkles, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
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

const SPARK_ANGLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];

export function MoneySentAnimation({
  status,
  amount,
  recipientName,
  recipientSubline,
  variant = "transfer",
  compact = false,
}: MoneySentAnimationProps) {
  const [displayAmount, setDisplayAmount] = useState(0);

  // Tactile mobile haptic pulse + smooth rolling number reveal when money is sent
  useEffect(() => {
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;

    if (
      status === "sent" &&
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      try {
        navigator.vibrate([38, 45, 85]);
      } catch {
        // Ignore blocked haptics
      }
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || status === "failed" || safeAmount === 0) {
      setDisplayAmount(safeAmount);
      return;
    }

    let rafId = 0;
    const duration = 640;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      // Cubic ease-out for crisp landing on exact amount
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(safeAmount * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayAmount(safeAmount);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [amount, status]);

  const title =
    status === "sent"
      ? variant === "contribution"
        ? "Contribution pooled!"
        : "Money sent!"
      : status === "failed"
      ? "Transfer failed"
      : "Money on the way";

  const statusPill =
    status === "sent"
      ? variant === "contribution"
        ? "Verified & Pooled"
        : "Delivered by CollectiPay"
      : status === "failed"
      ? "Refunded to wallet"
      : "Settling with recipient bank";

  const DestinationIcon = variant === "contribution" ? Users : Building2;

  return (
    <section
      key={`${status}-${variant}`}
      aria-live="polite"
      className={cn(
        "cp-money-stage",
        `cp-money-stage--${status}`,
        compact && "cp-money-stage--compact"
      )}
    >
      {/* Subtle architectural background glow & grid */}
      <div className="cp-money-stage-bg" aria-hidden="true" />

      {/* Top status badge */}
      <div className="cp-money-pill">
        {status === "sent" ? (
          <Sparkles size={12} aria-hidden="true" />
        ) : status === "failed" ? (
          <ShieldAlert size={12} aria-hidden="true" />
        ) : (
          <Clock3 size={12} className="animate-spin" style={{ animationDuration: "4s" }} aria-hidden="true" />
        )}
        <span>{statusPill}</span>
      </div>

      {/* Unique CollectiPay Flight Arc: Wallet -> Trajectory Shuttle -> Destination + Seal Bloom */}
      <div className="cp-money-flight" aria-hidden="true">
        <div className="cp-flight-node cp-flight-node--from">
          <Wallet size={17} />
        </div>

        <svg
          className="cp-flight-svg"
          viewBox="0 0 220 76"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="cp-flight-grad" x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
              <stop offset="55%" stopColor="#dbf5b4" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#6ee7b7" stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Base faint arc track */}
          <path
            d="M 14 54 Q 110 -8 206 54"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="2.5"
            strokeDasharray="4 6"
            strokeLinecap="round"
          />
          {/* Illuminated sweep arc */}
          {status !== "failed" && (
            <path
              className="cp-flight-arc"
              d="M 14 54 Q 110 -8 206 54"
              stroke="url(#cp-flight-grad)"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          )}
          {/* Flying Naira coin shuttle along the exact SVG Bezier trajectory (cross-browser native SVG motion) */}
          {status !== "failed" && (
            <g className="cp-flight-shuttle">
              <animateMotion
                dur={status === "processing" ? "1.8s" : "0.72s"}
                begin={status === "processing" ? "0s" : "0.09s"}
                repeatCount={status === "processing" ? "indefinite" : "1"}
                fill="freeze"
                calcMode="spline"
                keyTimes="0;1"
                keySplines={status === "processing" ? "0.45 0 0.55 1" : "0.22 1 0.36 1"}
                path="M 14 54 Q 110 -8 206 54"
              />
              <circle r="11" fill="#dbf5b4" />
              <circle r="15" fill="#dbf5b4" fillOpacity="0.22" />
              <text
                x="0"
                y="4.2"
                textAnchor="middle"
                fill="#073a2f"
                fontSize="12"
                fontWeight="800"
                fontFamily="Inter, system-ui, sans-serif"
              >
                ₦
              </text>
            </g>
          )}
        </svg>

        {/* Center celebration seal */}
        <div className="cp-money-seal-wrap">
          {status === "sent" && (
            <>
              <span className="cp-seal-ring cp-seal-ring--1" />
              <span className="cp-seal-ring cp-seal-ring--2" />
              <div className="cp-seal-sparks">
                {SPARK_ANGLES.map((angle, index) => (
                  <span
                    key={angle}
                    className="cp-seal-spark"
                    style={
                      {
                        "--spark-angle": `${angle}deg`,
                        "--spark-delay": `${320 + (index % 3) * 45}ms`,
                        "--spark-dist": index % 2 === 0 ? "46px" : "36px",
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            </>
          )}

          {status === "processing" && <span className="cp-seal-radar" />}

          <div className="cp-money-seal">
            {status === "sent" ? (
              <svg viewBox="0 0 36 36" className="cp-seal-check" fill="none">
                <path
                  d="M9.5 18.5L15.4 24.4L27 12.2"
                  stroke="currentColor"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : status === "failed" ? (
              <ShieldAlert size={24} />
            ) : (
              <Clock3 size={24} />
            )}
          </div>
        </div>

        <div className="cp-flight-node cp-flight-node--to">
          <DestinationIcon size={17} />
        </div>
      </div>

      {/* Headline & rolling amount */}
      <h2 className="cp-money-title">{title}</h2>
      <p className="cp-money-amount tabular-nums">{ngn.format(displayAmount)}</p>

      {/* Recipient route chip */}
      <div className="cp-money-recipient">
        <span className="cp-money-recipient-name">
          {status === "sent" && <Check size={13} className="shrink-0 text-[#dbf5b4]" aria-hidden="true" />}
          <span className="truncate">{recipientName}</span>
        </span>
        {recipientSubline && (
          <span className="cp-money-recipient-sub">{recipientSubline}</span>
        )}
      </div>
    </section>
  );
}
