import React, { useId } from "react";
import { cn } from "@/lib/utils";
import "@/styles/brand-loader.css";

export interface CollectiPayMarkProps {
  size?: number;
  className?: string;
}

/**
 * Crisp static vector reconstruction of the CollectiPay emerald "C" emblem
 * (ideal for receipts, certificates, and native headers — never relies on external PNGs).
 */
export const CollectiPayMark: React.FC<CollectiPayMarkProps> = ({
  size = 32,
  className,
}) => {
  const uid = useId().replace(/:/g, "");
  const gradId = `cp-static-grad-${uid}`;
  const maskId = `cp-static-mask-${uid}`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="16" y1="12" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#26AD6A" />
          <stop offset="55%" stopColor="#1E965B" />
          <stop offset="100%" stopColor="#10613E" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect x="0" y="0" width="120" height="120" fill="#FFFFFF" />
          <rect x="60" y="53.5" width="42" height="13" fill="#000000" />
        </mask>
      </defs>
      <circle cx="60" cy="60" r="56" fill={`url(#${gradId})`} />
      <circle cx="60" cy="60" r="54.8" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1.5" />
      <g mask={`url(#${maskId})`}>
        <circle cx="60" cy="60" r="24" stroke="#FFFFFF" strokeWidth="13" />
      </g>
    </svg>
  );
};

export interface BrandLoaderProps {
  /** Primary status message shown beneath the emblem */
  message?: string;
  /** Optional supporting caption for longer verification/sync states */
  submessage?: string;
  /** Optional compact pill label (e.g. "Step 2 of 3" or "Bank Transfer") shown on overlay variant */
  badge?: string;
  /**
   * Layout variant:
   * - "fullscreen": full viewport brand splash with subtle blueprint grid and wordmark
   * - "overlay": native frosted-glass processing sheet over the active screen (transfers, group creation, contributions)
   * - "page": centered in-page loader for routes that already render the app Header
   * - "inline": compact kinetic emblem for embedded sections/cards
   */
  variant?: "fullscreen" | "overlay" | "page" | "inline";
  /** Override emblem size in pixels */
  size?: number;
  /** Show the CollectiPay wordmark (defaults to true on fullscreen) */
  showWordmark?: boolean;
  /** Show the hairline shimmer progress bar (defaults to true on fullscreen, overlay, page) */
  showProgressBar?: boolean;
  className?: string;
}

const DEFAULT_SIZE: Record<NonNullable<BrandLoaderProps["variant"]>, number> = {
  fullscreen: 108,
  overlay: 92,
  page: 84,
  inline: 48,
};

/**
 * CollectiPay Kinetic Brand Emblem ("The Pooling C")
 * Built directly from the CollectiPay "C"-in-emerald-disc logo blueprint:
 * - Architectural stencil track of the geometric open "C"
 * - Mint-lime contribution spark gliding through the mouth of the "C" into the shared pool
 * - Luminous white "C" arc sweeping around the blueprint track on deposit
 * - Concentric consensus ripples radiating outward from the circular badge
 */
export const BrandLoader: React.FC<BrandLoaderProps> = ({
  message,
  submessage,
  badge,
  variant = "fullscreen",
  size,
  showWordmark,
  showProgressBar,
  className,
}) => {
  const uid = useId().replace(/:/g, "");
  const discGradId = `cp-disc-grad-${uid}`;
  const rimGradId = `cp-rim-grad-${uid}`;
  const mouthMaskId = `cp-mouth-mask-${uid}`;
  const sparkGlowId = `cp-spark-glow-${uid}`;

  const emblemSize = size ?? DEFAULT_SIZE[variant];
  const displayWordmark = showWordmark ?? variant === "fullscreen";
  const displayBar = showProgressBar ?? variant !== "inline";
  const isCompact = variant === "inline";

  const accessibleLabel = message || "Loading CollectiPay";

  const emblem = (
    <div
      className="brand-loader-emblem-wrap"
      style={{ width: emblemSize, height: emblemSize }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 120 120"
        width={emblemSize}
        height={emblemSize}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="brand-loader-svg"
      >
        <defs>
          <linearGradient id={discGradId} x1="20" y1="14" x2="102" y2="108" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#26AD6A" />
            <stop offset="52%" stopColor="#1E965B" />
            <stop offset="100%" stopColor="#0E5A3A" />
          </linearGradient>

          <linearGradient id={rimGradId} x1="18" y1="18" x2="104" y2="104" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D6F786" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#86EFAC" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#D6F786" stopOpacity="0" />
          </linearGradient>

          <filter id={sparkGlowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <mask id={mouthMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
            <rect x="0" y="0" width="120" height="120" fill="#FFFFFF" />
            <rect x="60" y="54.8" width="34" height="10.4" fill="#000000" />
          </mask>
        </defs>

        {!isCompact && (
          <g className="cp-blueprint-ring" opacity="0.45">
            <circle
              cx="60"
              cy="60"
              r="53"
              stroke="currentColor"
              className="text-primary/40"
              strokeWidth="1"
              strokeDasharray="2.5 6.5"
            />
            <line x1="60" y1="2.5" x2="60" y2="7.5" stroke="currentColor" className="text-primary/50" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="60" y1="112.5" x2="60" y2="117.5" stroke="currentColor" className="text-primary/50" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="2.5" y1="60" x2="7.5" y2="60" stroke="currentColor" className="text-primary/50" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="112.5" y1="60" x2="117.5" y2="60" stroke="currentColor" className="text-primary/50" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}

        <circle
          cx="60"
          cy="60"
          r="44"
          stroke="currentColor"
          className="cp-ripple-1 text-primary"
          strokeWidth="1.35"
        />
        {!isCompact && (
          <circle
            cx="60"
            cy="60"
            r="44"
            stroke="#A7E878"
            className="cp-ripple-2"
            strokeWidth="1"
          />
        )}

        <g className="cp-disc-group">
          <circle cx="60" cy="60" r="44" fill={`url(#${discGradId})`} />
          <circle
            cx="60"
            cy="60"
            r="43.25"
            stroke="#FFFFFF"
            strokeOpacity="0.22"
            strokeWidth="1.1"
          />
          <circle
            cx="60"
            cy="60"
            r="32"
            stroke="#D6F786"
            strokeOpacity="0.14"
            strokeWidth="0.9"
            strokeDasharray="2 4"
          />
          <circle
            cx="60"
            cy="60"
            r="43.25"
            stroke={`url(#${rimGradId})`}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="58 214"
            className="cp-rim-gleam"
          />

          <g mask={`url(#${mouthMaskId})`}>
            <circle
              cx="60"
              cy="60"
              r="18.5"
              stroke="#FFFFFF"
              strokeOpacity="0.22"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="18.5"
              stroke="#FFFFFF"
              strokeWidth="10"
              transform="translate(0 120) scale(1 -1)"
              className="cp-c-stroke"
            />
          </g>

          <circle
            cx="60"
            cy="60"
            r="5.5"
            fill="#D6F786"
            className="cp-core-bloom"
          />
          <circle
            cx="60"
            cy="60"
            r="3.2"
            fill="#D6F786"
            filter={`url(#${sparkGlowId})`}
            className="cp-pool-spark"
          />
        </g>
      </svg>
    </div>
  );

  if (variant === "inline") {
    return (
      <div
        className={cn("brand-loader-inline", className)}
        role="status"
        aria-live="polite"
      >
        {emblem}
        {message ? (
          <p className="text-xs font-medium text-muted-foreground">{message}</p>
        ) : (
          <span className="sr-only">{accessibleLabel}</span>
        )}
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div
        className={cn("brand-loader-overlay", className)}
        role="dialog"
        aria-modal="true"
        aria-busy="true"
        aria-label={accessibleLabel}
      >
        <div className="brand-loader-sheet">
          <div className="brand-loader-stack">
            {emblem}
            {badge && (
              <div className="brand-loader-step-pill">
                <span className="brand-loader-step-dot" aria-hidden="true" />
                {badge}
              </div>
            )}
            {message && (
              <p className="mt-3 text-base font-semibold tracking-tight text-foreground">
                {message}
              </p>
            )}
            {submessage && (
              <p className="brand-loader-submessage">{submessage}</p>
            )}
            {displayBar && (
              <div className="brand-loader-bar" aria-hidden="true">
                <div className="brand-loader-bar-fill" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        variant === "fullscreen" ? "brand-loader-screen" : "brand-loader-page",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {variant === "fullscreen" && (
        <div className="brand-loader-grid" aria-hidden="true" />
      )}

      <div className="brand-loader-stack">
        {emblem}

        {displayWordmark && (
          <div className="brand-loader-wordmark">
            Collecti<span>Pay</span>
          </div>
        )}

        {message ? (
          <p className="brand-loader-message">{message}</p>
        ) : (
          <span className="sr-only">{accessibleLabel}</span>
        )}

        {submessage && (
          <p className="brand-loader-submessage">{submessage}</p>
        )}

        {displayBar && (
          <div className="brand-loader-bar" aria-hidden="true">
            <div className="brand-loader-bar-fill" />
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandLoader;
