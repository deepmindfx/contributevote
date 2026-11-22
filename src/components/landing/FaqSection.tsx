import { useState } from "react";
import { ArrowRight, ChevronDown, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategoryId } from "@/data/faqData";

export function FaqSection() {
  const [selectedCategory, setSelectedCategory] = useState<"featured" | FaqCategoryId>("featured");
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  const items =
    selectedCategory === "featured"
      ? FAQ_ITEMS.filter((item) => item.featured)
      : FAQ_ITEMS.filter((item) => item.category === selectedCategory);

  const handleCategoryChange = (next: "featured" | FaqCategoryId) => {
    setSelectedCategory(next);
    const nextList =
      next === "featured"
        ? FAQ_ITEMS.filter((item) => item.featured)
        : FAQ_ITEMS.filter((item) => item.category === next);
    setOpenId(nextList[0]?.id ?? null);
  };

  return (
    <section id="faq" className="landing-faq" aria-labelledby="faq-title">
      <div className="landing-width">
        <div className="landing-faq-layout">
          <div className="landing-faq-intro" data-scroll-reveal>
            <span className="landing-faq-eyebrow">
              <HelpCircle size={14} aria-hidden="true" />
              Frequently asked questions
            </span>
            <h2 id="faq-title">Clear answers before you pool a kobo.</h2>
            <p>
              Everything you need to know about funding wallets, voting thresholds, bank transfers, and keeping group money transparent.
            </p>
            <div className="landing-faq-filters" role="tablist" aria-label="FAQ categories">
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategory === "featured"}
                data-active={selectedCategory === "featured"}
                onClick={() => handleCategoryChange("featured")}
                className="landing-faq-chip"
              >
                Popular
              </button>
              {FAQ_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === category.id}
                  data-active={selectedCategory === category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className="landing-faq-chip"
                >
                  {category.label}
                </button>
              ))}
            </div>
            <Link to="/faq" className="landing-faq-all-link">
              Search all {FAQ_ITEMS.length} questions <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="landing-faq-list" data-scroll-reveal>
            {items.map((item) => {
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
                      <ChevronDown className="landing-faq-chevron" size={18} aria-hidden="true" />
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
