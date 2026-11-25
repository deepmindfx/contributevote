import { useEffect, useRef } from "react";
import { CollectiPayMark } from "@/components/ui/BrandLoader";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function SmartShowcaseSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const wordLeftRef = useRef<HTMLSpanElement>(null);
  const wordRightRef = useRef<HTMLSpanElement>(null);

  // Scroll-linked PayPal-style portal expansion ("Pool, send, and save smarter")
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
    let initialized = false;

    const computeTarget = () => {
      const travel = Math.max(1, track.offsetHeight - sticky.offsetHeight);
      const rect = track.getBoundingClientRect();
      return clamp(-rect.top / travel, 0, 1);
    };

    const paintPortal = (p: number) => {
      const isMobile = window.innerWidth < 768;

      // 1. Headline stays fully visible below fixed header, then rises and fades as card expands (0.04 -> 0.38)
      const headT = smoothstep(clamp((p - 0.04) / 0.34, 0, 1));
      if (headlineRef.current) {
        headlineRef.current.style.transform = `translate3d(0, ${(-headT * 38).toFixed(2)}px, 0) scale(${(1 - headT * 0.04).toFixed(4)})`;
        headlineRef.current.style.opacity = (1 - headT * 0.96).toFixed(4);
      }

      // Measure actual headline bottom so the card NEVER overlaps "save smarter" or the fixed header
      const headEl = headlineRef.current;
      const headBottom = headEl
        ? headEl.offsetTop + headEl.offsetHeight
        : isMobile
          ? 188
          : 232;
      const minStartTop = isMobile ? 204 : 254;
      const startTop = Math.max(minStartTop, headBottom + (isMobile ? 20 : 30));

      // 2. Portal card expands from centered rounded card below headline to full-bleed stage (0.08 -> 0.74)
      const expandT = smoothstep(clamp((p - 0.08) / 0.66, 0, 1));
      const startSide = isMobile ? 4.5 : 11.5;
      const startBottom = isMobile ? 18 : 28;
      const startRadius = isMobile ? 28 : 36;

      const topPx = (1 - expandT) * startTop;
      const sidePct = (1 - expandT) * startSide;
      const bottomPx = (1 - expandT) * startBottom;
      const radiusPx = (1 - expandT) * startRadius;

      if (cardRef.current) {
        cardRef.current.style.clipPath = `inset(${topPx.toFixed(2)}px ${sidePct.toFixed(3)}% ${bottomPx.toFixed(2)}px ${sidePct.toFixed(3)}% round ${radiusPx.toFixed(2)}px)`;
      }

      // 3. White CollectiPay top bar rides the top edge of the clipped card, then tucks away (0.20 -> 0.56)
      const barT = smoothstep(clamp((p - 0.20) / 0.36, 0, 1));
      if (topbarRef.current) {
        topbarRef.current.style.opacity = (1 - barT).toFixed(4);
        topbarRef.current.style.transform = `translate3d(0, ${(topPx - barT * 32).toFixed(2)}px, 0)`;
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
    };

    const tick = (now: number) => {
      rafId = 0;
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
      lastTime = now;

      const alpha = 1 - Math.exp(-dt * 14);
      currentP += (targetP - currentP) * alpha;

      if (Math.abs(targetP - currentP) < 0.0006) {
        currentP = targetP;
        paintPortal(currentP);
        lastTime = 0;
        return;
      }

      paintPortal(currentP);
      rafId = requestAnimationFrame(tick);
    };

    const onScrollOrResize = () => {
      targetP = computeTarget();

      if (!initialized) {
        initialized = true;
        currentP = targetP;
        paintPortal(currentP);
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
    </section>
  );
}
