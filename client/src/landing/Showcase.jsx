import { Check } from 'lucide-react'
import Reveal from '../components/Reveal'
import WidgetPreview from './WidgetPreview'

const POINTS = [
  'Every part is pulled from products you actually stock — nothing shown is out of reach or out of stock.',
  'Three tiers per request: Budget, Balanced, and Max — so shoppers see trade-offs, not just one answer.',
  'Prices always stay inside the budget the shopper set, with the remaining headroom shown clearly.',
  'Recommendations are cached per store, so repeat requests stay fast and cost-efficient.',
]

export default function Showcase() {
  return (
    <section className="lp-section">
      <div className="lp-container lp-showcase">
        <Reveal variant="left" className="lp-showcase-visual">
          <WidgetPreview />
        </Reveal>

        <div className="lp-showcase-copy">
          <Reveal as="p" className="lp-eyebrow">
            Product intelligence
          </Reveal>
          <Reveal as="h2" delay={60} className="lp-section-title lp-section-title-left">
            Recommendations that respect budget, stock, and intent
          </Reveal>
          <Reveal as="p" delay={100} className="lp-section-subtitle lp-section-subtitle-left">
            BuildBot isn't a static configurator — it reasons about your
            catalog in real time so every suggestion is one your shop can
            actually fulfill.
          </Reveal>

          <ul className="lp-check-list">
            {POINTS.map((point, i) => (
              <Reveal as="li" key={point} delay={140 + i * 70}>
                <Check size={16} strokeWidth={3} />
                <span>{point}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
