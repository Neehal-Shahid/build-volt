import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Reveal from '../components/Reveal'

const FAQS = [
  {
    q: 'Do I need to know how to code to install the widget?',
    a: 'No. Copy one script tag from the Install Widget tab and paste it into your site — or install the WooCommerce plugin, which injects it automatically.',
  },
  {
    q: "What if I don't use WooCommerce?",
    a: 'Manual catalog mode works with any storefront. Add products by hand or upload a CSV, and the widget works exactly the same way.',
  },
  {
    q: 'Does BuildBot recommend real products from my store?',
    a: 'Yes. Every build is assembled from your live catalog and only shows parts that are actually in stock.',
  },
  {
    q: 'How does billing work?',
    a: 'Submit a JazzCash or EasyPaisa transaction reference for admin approval, or use instant demo card checkout where enabled by the admin.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — every new store gets a free trial with a daily recommendation limit, no credit card required.',
  },
  {
    q: "Can I customize the widget's look?",
    a: 'Brand color, background, title, welcome message, currency, and budget presets are all editable from your Widget Settings tab.',
  },
]

export default function Faq() {
  const [open, setOpen] = useState(0)

  return (
    <section id="faq" className="lp-section lp-section-muted">
      <div className="lp-container lp-faq">
        <div className="lp-faq-head">
          <Reveal as="p" className="lp-eyebrow">
            FAQ
          </Reveal>
          <Reveal as="h2" delay={60} className="lp-section-title lp-section-title-left">
            Questions store owners ask us
          </Reveal>
          <Reveal as="p" delay={100} className="lp-section-subtitle lp-section-subtitle-left">
            Can't find your answer? Reach out from the Help tab once you're
            signed in, or contact us directly.
          </Reveal>
        </div>

        <div className="lp-faq-list">
          {FAQS.map((item, i) => {
            const isOpen = open === i
            return (
              <Reveal as="div" key={item.q} delay={i * 60} className="lp-faq-item">
                <button
                  type="button"
                  className="lp-faq-question"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{item.q}</span>
                  <ChevronDown size={18} className={`lp-faq-chevron ${isOpen ? 'is-open' : ''}`} />
                </button>
                <div className={`lp-faq-answer ${isOpen ? 'is-open' : ''}`}>
                  <p>{item.a}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
