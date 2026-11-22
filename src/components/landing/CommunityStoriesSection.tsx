import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const stories = [
  {
    eyebrow: "01",
    title: "Mosques & waqf",
    description:
      "Collect for a masjid, a borehole, or a community project and share the progress with everyone who contributed.",
    image: "story-mosque.webp",
    alt: "Mosque committee members reviewing plans in a sunlit courtyard",
  },
  {
    eyebrow: "02",
    title: "Churches & outreach",
    description:
      "Bring welfare and outreach contributions into one place, with receipts your members can keep.",
    image: "story-church.webp",
    alt: "Church volunteers preparing supplies for a community outreach project",
  },
  {
    eyebrow: "03",
    title: "Inventors & makers",
    description:
      "Collect funding for the next prototype and let eligible backers vote on withdrawals.",
    image: "story-inventors.webp",
    alt: "Nigerian inventors testing a prototype together in a workshop",
  },
  {
    eyebrow: "04",
    title: "Families & cooperatives",
    description:
      "Save toward family plans, alumni projects, and cooperative goals with a shared record of every contribution.",
    image: "story-community.webp",
    alt: "Family and friends gathered around a table in the sunshine",
  },
];

type StoriesMode = "static" | "scroll" | "carousel";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Maps normalized scroll travel [0..1] to a continuous slide index [0..count-1]
 * with calm reading plateaus around each integer slide and cubic smoothstep glides between them.
 */
function scrollProgressToSlide(rawProgress: number, count: number): number {
  const last = count - 1;
  if (last <= 0) return 0;

  const pad = 0.08;
  const clamped = clamp(rawProgress, 0, 1);
  if (clamped <= pad) return 0;
  if (clamped >= 1 - pad) return last;

  const normalized = (clamped - pad) / (1 - pad * 2);
  const scaled = normalized * last;
  const seg = Math.min(last - 1, Math.floor(scaled));
  const frac = scaled - seg;

  const dwell = 0.16;
  if (frac <= dwell) return seg;
  if (frac >= 1 - dwell) return seg + 1;

  const localT = (frac - dwell) / (1 - dwell * 2);
  return seg + smoothstep(localT);
}

/** Inverse center point for jumping smoothly to a specific slide via chapter controls */
function slideIndexToScrollProgress(index: number, count: number): number {
  const last = count - 1;
  if (last <= 0) return 0;
  const pad = 0.08;
  if (index <= 0) return pad * 0.45;
  if (index >= last) return 1 - pad * 0.45;
  return pad + (index / last) * (1 - pad * 2);
}

export function CommunityStoriesSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const mediaRefs = useRef<(HTMLImageElement | null)[]>([]);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const progressRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const [mode, setMode] = useState<StoriesMode>("static");
  const [active, setActive] = useState(0);
  const [preload, setPreload] = useState(false);

  const activeRef = useRef(0);

  // Pick the most native interaction model for the user's device and motion preferences
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopScroll = window.matchMedia("(min-width: 48rem) and (min-height: 30rem)");

    const updateMode = () => {
      if (reduced.matches) {
        setMode("static");
      } else if (desktopScroll.matches) {
        setMode("scroll");
      } else {
        setMode("carousel");
      }
    };

    updateMode();
    reduced.addEventListener("change", updateMode);
    desktopScroll.addEventListener("change", updateMode);
    return () => {
      reduced.removeEventListener("change", updateMode);
      desktopScroll.removeEventListener("change", updateMode);
    };
  }, []);

  // Preload all 4 compact WebP story photos shortly before the section enters view
  useEffect(() => {
    if (preload || !trackRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPreload(true);
          observer.disconnect();
        }
      },
      { rootMargin: "680px 0px" }
    );
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, [preload]);

  const paintProgressBars = useCallback((pos: number) => {
    for (let i = 0; i < stories.length; i++) {
      const fillEl = progressRefs.current[i];
      if (!fillEl) continue;
      let fill = 0;
      if (i < Math.floor(pos)) {
        fill = 1;
      } else if (i === stories.length - 1) {
        fill = clamp(1 - (i - pos), 0, 1);
      } else {
        fill = clamp(pos - i + 1, 0, 1);
        if (pos > i) {
          // Gently fills current chapter while gliding toward next
          fill = clamp(0.28 + (pos - i) * 0.72, 0.28, 1);
        } else {
          fill = clamp(1 - (i - pos), 0, 1) * 0.28;
        }
      }
      fillEl.style.transform = `scaleX(${fill.toFixed(4)})`;
    }
  }, []);

  const resetInlineStyles = useCallback(() => {
    for (let i = 0; i < stories.length; i++) {
      const slide = slideRefs.current[i];
      const img = mediaRefs.current[i];
      const caption = captionRefs.current[i];
      if (slide) {
        slide.style.transform = "";
        slide.style.opacity = "";
        slide.style.zIndex = "";
        slide.style.pointerEvents = "";
      }
      if (img) img.style.transform = "";
      if (caption) {
        caption.style.transform = "";
        caption.style.opacity = "";
      }
    }
  }, []);

  // MODE 1 (Desktop): Spring-damped, GPU-composited scroll-linked card deck
  useEffect(() => {
    if (mode !== "scroll") {
      resetInlineStyles();
      return;
    }

    const container = trackRef.current;
    const sticky = sceneRef.current;
    if (!container || !sticky) return;

    let rafId = 0;
    let lastTime = 0;
    let targetPos = 0;
    let currentPos = 0;
    let initialized = false;

    const computeTarget = () => {
      const stickyTop = parseFloat(getComputedStyle(sticky).top) || 0;
      const travel = container.offsetHeight - sticky.offsetHeight;
      if (travel <= 0) return 0;
      const raw = (stickyTop - container.getBoundingClientRect().top) / travel;
      return scrollProgressToSlide(raw, stories.length);
    };

    const applyDeckTransforms = (pos: number) => {
      for (let i = 0; i < stories.length; i++) {
        const slide = slideRefs.current[i];
        const img = mediaRefs.current[i];
        const caption = captionRefs.current[i];
        if (!slide) continue;

        const d = i - pos; // < 0 receding behind, 0 centered, > 0 rising into view

        if (d <= 0) {
          const t = clamp(-d, 0, 1);
          const eased = smoothstep(t);
          const scale = 1 - eased * 0.045;
          const liftY = -eased * 16;
          // Keep receding card rich underneath the incoming card so dark backdrop never flashes
          const opacity = t >= 0.995 ? 0 : 1 - eased * 0.58;

          slide.style.transform = `translate3d(0, ${liftY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
          slide.style.opacity = opacity.toFixed(4);
          slide.style.zIndex = String(i + 1);
          slide.style.pointerEvents = t < 0.45 ? "auto" : "none";

          if (img) {
            img.style.transform = `translate3d(0, ${(-eased * 10).toFixed(2)}px, 0) scale(${(1 + eased * 0.045).toFixed(4)})`;
          }
          if (caption) {
            const capOpacity = clamp(1 - t * 1.65, 0, 1);
            caption.style.transform = `translate3d(0, ${(-eased * 18).toFixed(2)}px, 0)`;
            caption.style.opacity = capOpacity.toFixed(4);
          }
        } else {
          const t = clamp(d, 0, 1);
          const eased = smoothstep(t);
          const riseY = eased * 52;
          const scale = 1 - eased * 0.025;
          const opacity = t >= 0.995 ? 0 : clamp(1 - Math.pow(t, 1.25), 0, 1);

          slide.style.transform = `translate3d(0, ${riseY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
          slide.style.opacity = opacity.toFixed(4);
          slide.style.zIndex = String(i + 1);
          slide.style.pointerEvents = t < 0.45 ? "auto" : "none";

          if (img) {
            const imgScale = 1 + eased * 0.075;
            img.style.transform = `translate3d(0, ${(eased * -18).toFixed(2)}px, 0) scale(${imgScale.toFixed(4)})`;
          }
          if (caption) {
            const capOpacity = clamp(1 - t * 1.45, 0, 1);
            caption.style.transform = `translate3d(0, ${(eased * 28).toFixed(2)}px, 0)`;
            caption.style.opacity = capOpacity.toFixed(4);
          }
        }
      }

      paintProgressBars(pos);

      const snapped = clamp(Math.round(pos), 0, stories.length - 1);
      if (snapped !== activeRef.current) {
        activeRef.current = snapped;
        setActive(snapped);
      }
    };

    const tick = (now: number) => {
      rafId = 0;
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
      lastTime = now;

      // Frame-rate-independent exponential spring damping (60Hz / 120Hz consistent)
      const alpha = 1 - Math.exp(-dt * 15);
      currentPos += (targetPos - currentPos) * alpha;

      if (Math.abs(targetPos - currentPos) < 0.0005) {
        currentPos = targetPos;
        applyDeckTransforms(currentPos);
        lastTime = 0;
        return;
      }

      applyDeckTransforms(currentPos);
      rafId = requestAnimationFrame(tick);
    };

    const onScrollOrResize = () => {
      targetPos = computeTarget();
      if (!initialized) {
        initialized = true;
        currentPos = targetPos;
        applyDeckTransforms(currentPos);
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
  }, [mode, paintProgressBars, resetInlineStyles]);

  // MODE 2 (Mobile / Touch): Native CSS scroll-snap carousel with live finger-locked depth focus
  useEffect(() => {
    if (mode !== "carousel") return;
    const deck = deckRef.current;
    if (!deck) return;

    let rafId = 0;

    const updateCarouselDepth = () => {
      rafId = 0;
      const deckRect = deck.getBoundingClientRect();
      const deckCenter = deckRect.left + deckRect.width / 2;
      let nearestIdx = 0;
      let nearestDist = Infinity;
      let continuousPos = 0;

      const centers: number[] = [];
      for (let i = 0; i < stories.length; i++) {
        const slide = slideRefs.current[i];
        const img = mediaRefs.current[i];
        if (!slide) continue;

        const rect = slide.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        centers.push(center);

        const rawNorm = (center - deckCenter) / Math.max(1, rect.width);
        const absNorm = clamp(Math.abs(rawNorm), 0, 1);

        const scale = 1 - absNorm * 0.045;
        const opacity = 1 - absNorm * 0.34;
        slide.style.transform = `scale(${scale.toFixed(4)})`;
        slide.style.opacity = opacity.toFixed(4);

        if (img) {
          const parallaxX = clamp(rawNorm, -1, 1) * -14;
          img.style.transform = `translate3d(${parallaxX.toFixed(2)}px, 0, 0) scale(${(1.04 - (1 - absNorm) * 0.04).toFixed(4)})`;
        }

        if (Math.abs(center - deckCenter) < nearestDist) {
          nearestDist = Math.abs(center - deckCenter);
          nearestIdx = i;
        }
      }

      if (centers.length >= 2) {
        const span = centers[centers.length - 1] - centers[0];
        if (span > 0) {
          continuousPos = clamp(((deckCenter - centers[0]) / span) * (stories.length - 1), 0, stories.length - 1);
        }
      }

      paintProgressBars(continuousPos);

      if (nearestIdx !== activeRef.current) {
        activeRef.current = nearestIdx;
        setActive(nearestIdx);
      }
    };

    const queue = () => {
      if (!rafId) rafId = requestAnimationFrame(updateCarouselDepth);
    };

    updateCarouselDepth();
    deck.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      deck.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [mode, paintProgressBars]);

  const selectStory = useCallback(
    (index: number) => {
      const targetIndex = clamp(index, 0, stories.length - 1);

      if (mode === "scroll" && trackRef.current && sceneRef.current) {
        const offset = parseFloat(getComputedStyle(sceneRef.current).top) || 0;
        const start = trackRef.current.getBoundingClientRect().top + window.scrollY - offset;
        const travel = trackRef.current.offsetHeight - sceneRef.current.offsetHeight;
        const targetProgress = slideIndexToScrollProgress(targetIndex, stories.length);
        window.scrollTo({ top: start + travel * targetProgress, behavior: "smooth" });
        return;
      }

      if (mode === "carousel" && deckRef.current) {
        const slide = slideRefs.current[targetIndex];
        if (slide) {
          const deck = deckRef.current;
          const targetLeft = slide.offsetLeft - (deck.clientWidth - slide.clientWidth) / 2;
          deck.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
        }
      }
    },
    [mode]
  );

  return (
    <section id="stories" className="landing-stories" aria-labelledby="stories-heading">
      <div className="landing-width">
        <header className="landing-stories-head" data-scroll-reveal>
          <h2 id="stories-heading">Built for real communities.</h2>
          <p>Fund a shared goal, from a place of worship to a new invention.</p>
        </header>

        <div ref={trackRef} className="landing-stories-track" data-stories-mode={mode}>
          <div ref={sceneRef} className="landing-stories-scene">
            <div ref={deckRef} className="landing-stories-deck" tabIndex={mode === "carousel" ? 0 : undefined} aria-label="Community stories">
              {stories.map((story, index) => (
                <article
                  key={story.image}
                  ref={(el) => {
                    slideRefs.current[index] = el;
                  }}
                  className="landing-story-slide"
                  data-active={index === active}
                  aria-hidden={mode === "scroll" && index !== active ? true : undefined}
                >
                  <div className="landing-story-media">
                    <img
                      ref={(el) => {
                        mediaRefs.current[index] = el;
                      }}
                      src={"/images/stories/" + story.image}
                      alt={story.alt}
                      loading={preload || index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      width={1376}
                      height={768}
                    />
                  </div>
                  <div
                    ref={(el) => {
                      captionRefs.current[index] = el;
                    }}
                    className="landing-story-caption"
                  >
                    <span className="landing-story-step" aria-hidden="true">
                      {story.eyebrow} / 0{stories.length}
                    </span>
                    <h3>{story.title}</h3>
                    <p>{story.description}</p>
                  </div>
                </article>
              ))}
            </div>

            {mode !== "static" && (
              <div className="landing-story-bar">
                <div className="landing-story-controls" role="tablist" aria-label="Choose a community story">
                  {stories.map((story, index) => (
                    <button
                      key={story.image}
                      type="button"
                      role="tab"
                      aria-selected={index === active}
                      aria-label={`${story.title} (${index + 1} of ${stories.length})`}
                      onClick={() => selectStory(index)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight") {
                          e.preventDefault();
                          selectStory(index + 1);
                        } else if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          selectStory(index - 1);
                        }
                      }}
                      className="landing-story-pill"
                      data-active={index === active}
                    >
                      <span className="landing-story-pill-label">{story.title}</span>
                      <span className="landing-story-pill-track" aria-hidden="true">
                        <span
                          ref={(el) => {
                            progressRefs.current[index] = el;
                          }}
                          className="landing-story-pill-fill"
                        />
                      </span>
                    </button>
                  ))}
                </div>

                <div className="landing-story-arrows">
                  <button
                    type="button"
                    aria-label="Previous story"
                    disabled={active === 0}
                    onClick={() => selectStory(active - 1)}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next story"
                    disabled={active === stories.length - 1}
                    onClick={() => selectStory(active + 1)}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
