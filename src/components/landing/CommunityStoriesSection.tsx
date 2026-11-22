import { useEffect, useRef, useState } from "react";

const stories = [
  {
    title: "Mosques & waqf",
    description: "Collect for a masjid, a borehole, or a community project and share the progress with everyone who contributed.",
    image: "story-mosque.webp",
    alt: "Mosque committee members reviewing plans in a sunlit courtyard",
  },
  {
    title: "Churches & outreach",
    description: "Bring welfare and outreach contributions into one place, with receipts your members can keep.",
    image: "story-church.webp",
    alt: "Church volunteers preparing supplies for a community outreach project",
  },
  {
    title: "Inventors & makers",
    description: "Collect funding for the next prototype and let eligible backers vote on withdrawals.",
    image: "story-inventors.webp",
    alt: "Nigerian inventors testing a prototype together in a workshop",
  },
  {
    title: "Families & cooperatives",
    description: "Save toward family plans, alumni projects, and cooperative goals with a shared record of every contribution.",
    image: "story-community.webp",
    alt: "Family and friends gathered around a table in the sunshine",
  },
];

export function CommunityStoriesSection() {
  const track = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(0);
  const [preload, setPreload] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 28rem)");
    const update = () => setEnabled(motion.matches);
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled || preload || !scene.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setPreload(true);
        observer.disconnect();
      }
    }, { rootMargin: "560px 0px" });
    observer.observe(scene.current);
    return () => observer.disconnect();
  }, [enabled, preload]);

  useEffect(() => {
    if (!enabled || !track.current || !scene.current) return;
    const container = track.current;
    const sticky = scene.current;
    let frame = 0;

    function readScroll() {
      frame = 0;
      const offset = parseFloat(getComputedStyle(sticky).top) || 0;
      const travel = container.offsetHeight - sticky.offsetHeight;
      if (travel <= 0) return;
      const progress = (offset - container.getBoundingClientRect().top) / travel;
      setActive(Math.min(stories.length - 1, Math.max(0, Math.floor(progress * stories.length))));
    }

    function queue() {
      if (!frame) frame = requestAnimationFrame(readScroll);
    }

    readScroll();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [enabled]);

  function select(index: number) {
    if (!track.current || !scene.current) return;
    const offset = parseFloat(getComputedStyle(scene.current).top) || 0;
    const start = track.current.getBoundingClientRect().top + window.scrollY - offset;
    const travel = track.current.offsetHeight - scene.current.offsetHeight;
    window.scrollTo({ top: start + travel * ((index + 0.5) / stories.length), behavior: "smooth" });
  }

  return (
    <section id="stories" className="landing-stories" aria-labelledby="stories-heading">
      <div className="landing-width">
        <header className="landing-stories-head" data-scroll-reveal>
          <h2 id="stories-heading">Built for real communities.</h2>
          <p>Fund a shared goal, from a place of worship to a new invention.</p>
        </header>
        <div ref={track} className="landing-stories-track" data-scroll-stories={enabled}>
          <div ref={scene} className="landing-stories-scene">
            <div className="landing-stories-deck">
              {stories.map((story, index) => (
                <article key={story.image} className="landing-story-slide" data-active={index === active} aria-hidden={enabled && index !== active ? true : undefined}>
                  <img src={"/images/stories/" + story.image} alt={story.alt} loading={enabled && preload ? "eager" : "lazy"}
                    decoding="async" width={1376} height={768} />
                  <div className="landing-story-caption">
                    <h3>{story.title}</h3>
                    <p>{story.description}</p>
                  </div>
                </article>
              ))}
            </div>
            {enabled && (
              <div className="landing-story-controls" role="group" aria-label="Community stories">
                {stories.map((story, index) => (
                  <button key={story.image} type="button" aria-label={story.title} aria-current={index === active ? "true" : undefined}
                    onClick={() => select(index)}><span /></button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
