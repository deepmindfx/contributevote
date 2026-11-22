import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Lock, Send, Vote } from "lucide-react";
import { Link } from "react-router-dom";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { IPhone18ProMaxMockup, type PhoneDemoScreen } from "./IPhone18ProMaxMockup";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const SHOWCASE_MODES: Array<{
  id: PhoneDemoScreen;
  tabLabel: string;
  icon: typeof Lock;
  headline: string;
  description: string;
  badge: string;
}> = [
  {
    id: "wallet",
    tabLabel: "App Dashboard",
    icon: Lock,
    headline: "Your wallet and groups in one place",
    description:
      "Receive instant bank deposits into your dedicated CollectiPay virtual account, switch between NGN and USD views, and track every shared group goal in real time.",
    badge: "Try switching NGN / USD or hiding the balance inside the iPhone",
  },
  {
    id: "transfer",
    tabLabel: "1-Tap Transfers",
    icon: Send,
    headline: "Send to any Nigerian bank in one tap",
    description:
      "Tap anyone you’ve paid before from Recents or Favorites without re-entering their 10-digit account number, enjoy daily free transfers, and get instant verified receipts.",
    badge: "Live recipient verification & Naira flight confirmation",
  },
  {
    id: "vote",
    tabLabel: "Group Voting",
    icon: Vote,
    headline: "70% must vote. 60% yes to pass.",
    description:
      "Every contributor with a verified payment gets a real voice. Once 70% participate and 60% approve within 7 days, payouts or proportional refunds execute automatically.",
    badge: "Tap “Approve” inside the iPhone to test live consensus",
  },
];

export function SmartShowcaseSection() {
  const { isAuthenticated } = useSupabaseUser();
  const trackRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const wordLeftRef = useRef<HTMLSpanElement>(null);
  const wordRightRef = useRef<HTMLSpanElement>(null);
  const phoneStageRef = useRef<HTMLDivElement>(null);
  const phoneWrapRef = useRef<HTMLDivElement>(null);

  const [activeScreen, setActiveScreen] = useState<PhoneDemoScreen>("wallet");
  const activeMeta = SHOWCASE_MODES.find((m) => m.id === activeScreen) ?? SHOWCASE_MODES[0];

  // Scroll-linked PayPal portal expansion + iPhone 18 Pro Max parallax tilt
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const track = trackRef.current;
    const sticky = stickyRef.current;
    if (!track || !sticky) return;

    let rafId = 0;
    let lastTime = 0;
    let targetP = 0;
    let currentP = 0;
    let targetPhoneP = 0;
    let currentPhoneP = 0;
    let initialized = false;

    const computeTargets = () => {
      const travel = Math.max(1, track.offsetHeight - sticky.offsetHeight);
      const rect = track.getBoundingClientRect();
      const raw = clamp(-rect.top / travel, 0, 1);

      let phoneRaw = 0;
      const stageEl = phoneStageRef.current;
      if (stageEl) {
        const sRect = stageEl.getBoundingClientRect();
        const vh = Math.max(1, window.innerHeight);
        phoneRaw = clamp((vh - sRect.top) / (vh + sRect.height), 0, 1);
      }
      return { raw, phoneRaw };
    };

    const paintPortal = (p: number, phoneP: number) => {
      const isMobile = window.innerWidth < 768;

      // 1. Headline rises and fades as card expands (0.00 -> 0.42)
      const headT = smoothstep(clamp(p / 0.42, 0, 1));
      if (headlineRef.current) {
        headlineRef.current.style.transform = `translate3d(0, ${(-headT * 42).toFixed(2)}px, 0) scale(${(1 - headT * 0.04).toFixed(4)})`;
        headlineRef.current.style.opacity = (1 - headT * 0.92).toFixed(4);
      }

      // 2. Portal card expands from centered rounded card to full-bleed stage (0.04 -> 0.72)
      const expandT = smoothstep(clamp((p - 0.04) / 0.68, 0, 1));
      if (cardRef.current) {
        const startTop = isMobile ? 104 : 132;
        const startSide = isMobile ? 4.5 : 11.5;
        const startBottom = isMobile ? 18 : 28;
        const startRadius = isMobile ? 28 : 36;

        const topPx = (1 - expandT) * startTop;
        const sidePct = (1 - expandT) * startSide;
        const bottomPx = (1 - expandT) * startBottom;
        const radiusPx = (1 - expandT) * startRadius;

        cardRef.current.style.clipPath = `inset(${topPx.toFixed(2)}px ${sidePct.toFixed(3)}% ${bottomPx.toFixed(2)}px ${sidePct.toFixed(3)}% round ${radiusPx.toFixed(2)}px)`;
      }

      // 3. White CollectiPay top bar inside card tucks away as photo takes over (0.18 -> 0.54)
      const barT = smoothstep(clamp((p - 0.18) / 0.36, 0, 1));
      if (topbarRef.current) {
        topbarRef.current.style.opacity = (1 - barT).toFixed(4);
        topbarRef.current.style.transform = `translate3d(0, ${(-barT * 26).toFixed(2)}px, 0)`;
      }

      // 4. Inner lifestyle image subtle counter-scale & framing
      if (imageRef.current) {
        const imgScale = 1.08 - expandT * 0.08;
        imageRef.current.style.transform = `scale(${imgScale.toFixed(4)})`;
      }

      // 5. Split corner editorial display words ("pool" top-left, "smarter" bottom-right) (0.44 -> 0.88)
      const wordT = smoothstep(clamp((p - 0.44) / 0.44, 0, 1));
      if (wordLeftRef.current) {
        wordLeftRef.current.style.opacity = wordT.toFixed(4);
        wordLeftRef.current.style.transform = `translate3d(${((1 - wordT) * -42).toFixed(2)}px, ${((1 - wordT) * 10).toFixed(2)}px, 0)`;
      }
      if (wordRightRef.current) {
        wordRightRef.current.style.opacity = wordT.toFixed(4);
        wordRightRef.current.style.transform = `translate3d(${((1 - wordT) * 42).toFixed(2)}px, ${((1 - wordT) * -10).toFixed(2)}px, 0)`;
      }

      // 6. Tilted iPhone 18 Pro Max subtle scroll parallax float & rotation
      if (phoneWrapRef.current) {
        const liftY = (0.5 - phoneP) * 28;
        const tiltDeg = -8.5 + phoneP * 3.5;
        phoneWrapRef.current.style.transform = `translate3d(0, ${liftY.toFixed(2)}px, 0) rotate(${tiltDeg.toFixed(2)}deg)`;
      }
    };

    const tick = (now: number) => {
      rafId = 0;
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
      lastTime = now;

      const alpha = 1 - Math.exp(-dt * 14);
      currentP += (targetP - currentP) * alpha;
      currentPhoneP += (targetPhoneP - currentPhoneP) * alpha;

      const doneP = Math.abs(targetP - currentP) < 0.0006;
      const donePhone = Math.abs(targetPhoneP - currentPhoneP) < 0.0006;

      if (doneP && donePhone) {
        currentP = targetP;
        currentPhoneP = targetPhoneP;
        paintPortal(currentP, currentPhoneP);
        lastTime = 0;
        return;
      }

      paintPortal(currentP, currentPhoneP);
      rafId = requestAnimationFrame(tick);
    };

    const onScrollOrResize = () => {
      const { raw, phoneRaw } = computeTargets();
      targetP = raw;
      targetPhoneP = phoneRaw;

      if (!initialized) {
        initialized = true;
        currentP = targetP;
        currentPhoneP = targetPhoneP;
        paintPortal(currentP, currentPhoneP);
        return;
      }

      if (!rafId) {
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
      }
    };

    onScrollOrResize();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  return (
    <section
      id="smart-experience"
      className="cp-smart-showcase"
      aria-labelledby="cp-portal-headline"
    >
      {/* ACT 1: PayPal-Inspired Scroll-Expanding Portal */}
      <div ref={trackRef} className="cp-portal-track">
        <div ref={stickyRef} className="cp-portal-sticky">
          <h2 ref={headlineRef} id="cp-portal-headline" className="cp-portal-headline">
            Pool, send, and save smarter
          </h2>

          <div ref={cardRef} className="cp-portal-card">
            <div ref={topbarRef} className="cp-portal-topbar" aria-hidden="true">
              <CollectiPayMark size={26} />
              <span>CollectiPay</span>
            </div>

            <div className="cp-portal-media">
              <img
                ref={imageRef}
                src="/images/collectipay-portal-lifestyle.jpg"
                alt="CollectiPay mobile wallet lifestyle view on a warm sunlit table"
                width={1408}
                height={768}
                loading="eager"
                decoding="async"
              />
              <div className="cp-portal-vignette" aria-hidden="true" />
              <span ref={wordLeftRef} className="cp-portal-word cp-portal-word--left" aria-hidden="true">
                pool
              </span>
              <span ref={wordRightRef} className="cp-portal-word cp-portal-word--right" aria-hidden="true">
                smarter
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ACT 2: Crisp White Editorial Showcase + Tilted iPhone 18 Pro Max */}
      <div className="cp-iphone-showcase">
        <div className="landing-width">
          <div className="cp-iphone-header" data-scroll-reveal>
            <div className="cp-iphone-tabs" role="tablist" aria-label="Preview CollectiPay on iPhone 18 Pro Max">
              {SHOWCASE_MODES.map((item) => {
                const Icon = item.icon;
                const selected = item.id === activeScreen;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    data-active={selected}
                    onClick={() => setActiveScreen(item.id)}
                    className="cp-iphone-tab"
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span>{item.tabLabel}</span>
                  </button>
                );
              })}
            </div>

            <div key={activeMeta.id} className="cp-iphone-copy">
              <h3>{activeMeta.headline}</h3>
              <p>{activeMeta.description}</p>
            </div>
          </div>

          {/* Rounded Warm Studio Stage with Tilted iPhone 18 Pro Max (PayPal 00:05-00:08 style) */}
          <div ref={phoneStageRef} className="cp-iphone-stage" data-scroll-reveal>
            <div className="cp-iphone-stage-glow" aria-hidden="true" />

            <div className="cp-iphone-stage-meta">
              <span className="cp-iphone-live-pill">
                <span className="cp-iphone-live-dot" aria-hidden="true" />
                iPhone 18 Pro Max · Interactive Live Preview
              </span>
              <span className="cp-iphone-hint">{activeMeta.badge}</span>
            </div>

            <div className="cp-iphone-stage-center">
              <div ref={phoneWrapRef} className="cp-iphone-tilt-wrap">
                <IPhone18ProMaxMockup screen={activeScreen} interactive />
              </div>
            </div>

            <div className="cp-iphone-stage-footer">
              <Link
                to={isAuthenticated ? "/dashboard" : "/auth?mode=signup"}
                className="cp-iphone-cta"
              >
                {isAuthenticated ? "Open your wallet" : "Start with CollectiPay"}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <Link to="/transfer" className="cp-iphone-secondary-link">
                Try 1-tap bank transfers →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
