import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  HeartHandshake,
  Landmark,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StoryChapter {
  id: string;
  tabLabel: string;
  eyebrow: string;
  headline: string;
  narrative: string;
  quote: string;
  quoteAuthor: string;
  image: string;
  imageAlt: string;
  icon: typeof Landmark;
  poolPreview: {
    name: string;
    raised: string;
    target: string;
    percent: number;
    backers: string;
    rule: string;
  };
  highlights: string[];
  ctaLabel: string;
}

const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: "mosques",
    tabLabel: "Mosques & Waqf",
    eyebrow: "Chapter 01 · Mosques & Islamic Communities",
    headline: "From paper collection books to complete Jama’ah transparency.",
    narrative:
      "When a community rallies to expand a masjid, drill a solar borehole, or distribute Ramadan Zakat, trust is sacred. CollectiPay gives your building committee a dedicated bank account where every transfer is tracked publicly, contributors get instant verified receipts, and funds move only when your Shura and members vote yes.",
    quote:
      "Every Friday we share our CollectiPay Story card on the community WhatsApp group—members in Kano, Lagos, and London see the exact progress in real time.",
    quoteAuthor: "Alhaji Ibrahim M. · Masjid Expansion Committee",
    image: "/images/stories/story-mosque.webp",
    imageAlt:
      "Nigerian mosque elders and young community members reviewing building blueprints in a sunlit courtyard",
    icon: Landmark,
    poolPreview: {
      name: "Central Masjid Solar & Courtyard Wing",
      raised: "₦8,450,000",
      target: "₦10,000,000",
      percent: 85,
      backers: "312 members",
      rule: "70% Must Vote · 60% Yes",
    },
    highlights: [
      "Dedicated pool account number for Jumu’ah & diaspora transfers",
      "Anonymous Sadaqah toggle for private givers",
      "Democratic member approval before contractor payouts",
    ],
    ctaLabel: "Start a Mosque or Waqf Pool",
  },
  {
    id: "churches",
    tabLabel: "Churches & Outreach",
    eyebrow: "Chapter 02 · Churches & Faith Fellowships",
    headline: "Rally the whole congregation with radical financial accountability.",
    narrative:
      "Whether you are funding a youth auditorium, sound equipment, medical outreach, or welfare packages, members give more generously when they can see where every Naira goes. Publish a branded WhatsApp Story poster in seconds, track outside bank transfers cleanly, and keep elders and donors aligned with transparent governance.",
    quote:
      "No more chasing bank-alert screenshots across ten WhatsApp chats. Our welfare outreach hit 100% in two weeks because everyone trusted the ledger.",
    quoteAuthor: "Pastor Grace O. · Community Outreach Lead",
    image: "/images/stories/story-church.webp",
    imageAlt:
      "Joyful Nigerian church fellowship members organizing community charity boxes and reviewing an outreach plan together",
    icon: HeartHandshake,
    poolPreview: {
      name: "Lagos Back-to-School & Medical Outreach",
      raised: "₦4,620,000",
      target: "₦5,000,000",
      percent: 92,
      backers: "184 members",
      rule: "Verified Organizers · Live Ledger",
    },
    highlights: [
      "One-tap branded WhatsApp Status cards for Sunday announcements",
      "Instant digital receipts for every donor & department",
      "Built-in refund voting if an outreach plan ever changes",
    ],
    ctaLabel: "Launch a Church Fellowship Pool",
  },
  {
    id: "inventors",
    tabLabel: "Inventors & Crowdfunding",
    eyebrow: "Chapter 03 · Inventors, Makers & Startups",
    headline: "Crowdfund bold Nigerian inventions with milestone-gated trust.",
    narrative:
      "Brilliant hardware builders, agri-tech engineers, filmmakers, and open-source creators often stall at prototype funding because early supporters fear losing money. With CollectiPay, backers fund your milestone pool safely—and vote to unlock each build tranche once you share proof of progress.",
    quote:
      "Backers funded our solar cold-storage battery prototype because they knew their money couldn’t be touched without a 60% milestone vote.",
    quoteAuthor: "Chidi & Zainab · Clean-Tech Hardware Founders",
    image: "/images/stories/story-inventors.webp",
    imageAlt:
      "Two young Nigerian hardware inventors testing a sleek solar clean-energy battery prototype in a bright Lagos studio",
    icon: Cpu,
    poolPreview: {
      name: "SunGrid Mini — Off-Grid Solar Battery V1",
      raised: "₦12,300,000",
      target: "₦15,000,000",
      percent: 82,
      backers: "428 backers",
      rule: "Milestone Tranche Voting",
    },
    highlights: [
      "Turn WhatsApp, X & Facebook followers into verified backers",
      "BVN-verified founders with transparent AML oversight",
      "Automatic proportional refunds if a target isn’t reached",
    ],
    ctaLabel: "Crowdfund Your Invention",
  },
  {
    id: "communities",
    tabLabel: "Families, Alumni & Co-ops",
    eyebrow: "Chapter 04 · Families, Alumni & Cooperatives",
    headline: "Turn family goals, weddings & alumni pledges into funded realities.",
    narrative:
      "From diaspora siblings funding parents’ solar installation to university alumni renovating a lecture hall or neighborhood estates fixing a road—CollectiPay replaces awkward follow-ups with scheduled auto-contributions, dedicated bank accounts, and clear shared ownership.",
    quote:
      "Sixteen cousins across three continents pooled ₦6M for our family reunion and roof renovation without a single spreadsheet argument.",
    quoteAuthor: "Tunde A. · Family & Alumni Coordinator",
    image: "/images/stories/story-community.webp",
    imageAlt:
      "Multigenerational Nigerian family and close friends smiling and celebrating around a sunlit terrace table",
    icon: Users,
    poolPreview: {
      name: "Class of ’14 Engineering Lab Revival",
      raised: "₦6,150,000",
      target: "₦7,500,000",
      percent: 82,
      backers: "96 alumni",
      rule: "Scheduled Auto-Save · Vote Protected",
    },
    highlights: [
      "Private invite-only circles or discoverable public campaigns",
      "Weekly & monthly scheduled wallet contributions",
      "Audit-ready PDF statements & shareable receipts for every member",
    ],
    ctaLabel: "Create a Family or Alumni Pool",
  },
];

export function CommunityStoriesSection({ startPath }: { startPath: string }) {
  const [activeId, setActiveId] = useState(STORY_CHAPTERS[0].id);
  const active = STORY_CHAPTERS.find((c) => c.id === activeId) || STORY_CHAPTERS[0];

  return (
    <section id="stories" className="landing-stories" aria-labelledby="stories-heading">
      <div className="landing-width">
        {/* Editorial Intro */}
        <div className="landing-stories-head">
          <div>
            <span className="landing-stories-eyebrow">Built for Real Communities</span>
            <h2 id="stories-heading">
              One platform. Every circle that builds together.
            </h2>
            <p>
              From mosques and churches to hardware inventors crowdfunding Nigeria’s next
              breakthrough—see how real groups move from scattered bank alerts to accountable,
              democratic pooling.
            </p>
          </div>
        </div>

        {/* Interactive Chapter Switcher */}
        <div
          className="landing-story-tabs"
          role="tablist"
          aria-label="Community use-case stories"
        >
          {STORY_CHAPTERS.map((chapter) => {
            const Icon = chapter.icon;
            const isSelected = chapter.id === active.id;
            return (
              <button
                key={chapter.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveId(chapter.id)}
                className={cn("landing-story-tab", isSelected && "is-active")}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{chapter.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Featured Active Story Stage */}
        <article className="landing-story-stage" aria-live="polite">
          <div className="landing-story-media">
            <img
              src={active.image}
              alt={active.imageAlt}
              loading="lazy"
              decoding="async"
              className="landing-story-img"
            />
            {/* Floating Live CollectiPay Campaign Card Overlay */}
            <div className="landing-story-float">
              <div className="landing-story-float-top">
                <span className="landing-story-float-badge">
                  <ShieldCheck size={13} aria-hidden="true" /> Verified Pool
                </span>
                <span className="landing-story-float-pct">{active.poolPreview.percent}% funded</span>
              </div>
              <strong>{active.poolPreview.name}</strong>
              <div className="landing-story-float-bar">
                <span style={{ width: `${active.poolPreview.percent}%` }} />
              </div>
              <div className="landing-story-float-meta">
                <span>
                  <b>{active.poolPreview.raised}</b> of {active.poolPreview.target}
                </span>
                <span>{active.poolPreview.backers}</span>
              </div>
              <div className="landing-story-float-rule">
                <Vote size={12} aria-hidden="true" />
                <span>{active.poolPreview.rule}</span>
              </div>
            </div>
          </div>

          <div className="landing-story-copy">
            <p className="landing-story-kicker">{active.eyebrow}</p>
            <h3>{active.headline}</h3>
            <p className="landing-story-body">{active.narrative}</p>

            <ul className="landing-story-points">
              {active.highlights.map((point) => (
                <li key={point}>
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <blockquote className="landing-story-quote">
              <p>“{active.quote}”</p>
              <cite>— {active.quoteAuthor}</cite>
            </blockquote>

            <div className="landing-story-cta">
              <Link to={startPath} className="landing-button landing-button-primary">
                {active.ctaLabel} <ArrowRight size={17} style={{ marginLeft: "0.45rem" }} />
              </Link>
              <Link to="/discover" className="landing-story-link">
                Browse live public pools
              </Link>
            </div>
          </div>
        </article>

        {/* Visual Story Strip (Quick Preview Thumbnails of All 4 Chapters) */}
        <div className="landing-story-strip" aria-label="Explore all stories">
          {STORY_CHAPTERS.map((chapter) => {
            const isSelected = chapter.id === active.id;
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setActiveId(chapter.id)}
                className={cn("landing-story-thumb", isSelected && "is-active")}
              >
                <img src={chapter.image} alt="" loading="lazy" decoding="async" aria-hidden="true" />
                <div>
                  <strong>{chapter.tabLabel}</strong>
                  <span>{chapter.poolPreview.raised} raised</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bank-Grade Anti-Fraud & Anti-Money Laundering Trust Strip */}
        <div className="landing-trust-bar">
          <div className="landing-trust-item">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>Mandatory BVN Verification</strong>
              <span>Every group organizer completes 11-digit BVN identity verification before launching a pool.</span>
            </div>
          </div>
          <div className="landing-trust-item">
            <Building2 size={20} aria-hidden="true" />
            <div>
              <strong>External Transfers Tracked</strong>
              <span>Outside bank transfers and card contributions are logged, screened, and auditable end-to-end.</span>
            </div>
          </div>
          <div className="landing-trust-item">
            <Vote size={20} aria-hidden="true" />
            <div>
              <strong>Democratic Payout Locks</strong>
              <span>Contributors vote (at least 70% must vote &amp; 60% say yes) before pooled funds can be released.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
