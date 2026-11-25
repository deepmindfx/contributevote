import { useState } from "react";
import { ArrowRight, ChevronDown, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { FAQ_ITEMS } from "@/data/faqData";

export function FaqSection() {
  const featuredItems = FAQ_ITEMS.filter((item) => item.featured);
  const [openId, setOpenId] = useState<string | null>(featuredItems[0]?.id ?? null);

  return (
    <section id="faq" className="landing-faq" aria-labelledby="faq-title">
      <div className="landing-width">
        <div className="landing-faq-layout">
          <div className="landing-faq-intro" data-scroll-reveal>
            <span className="landing-faq-eyebrow">
              <HelpCircle size={14} aria-hidden="true" />
              FAQ
            </span>
            <h2 id="faq-title">Frequently Asked Questions</h2>
            <p>
              Everything you need to know about shared pools, democratic voting, Ice Vault, bulk
              transfers, and account security.
            </p>
            <Link to="/faq" className="landing-faq-all-link">
              <span>Browse all {FAQ_ITEMS.length} questions</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>

          <div className="landing-faq-list" data-scroll-reveal>
            {featuredItems.map((item) => {
              const isOpen = openId === item.id;
              return (
                <article
                  key={item.id}
                  className="landing-faq-item"
                  data-open={isOpen ? "true" : "false"}
                >
                  <h3>
                    <button
                      type="button"
                      className="landing-faq-trigger"
                      aria-expanded={isOpen}
                      aria-controls={`landing-faq-panel-${item.id}`}
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                    >
                      <span>{item.question}</span>
                      <ChevronDown className="landing-faq-chevron" size={17} aria-hidden="true" />
                    </button>
                  </h3>
                  <div
                    id={`landing-faq-panel-${item.id}`}
                    className="landing-faq-panel"
                    aria-hidden={!isOpen}
                  >
                    <div className="landing-faq-panel-inner">
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
