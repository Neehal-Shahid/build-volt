import { Banknote, Landmark, ShieldCheck } from 'lucide-react'
import Reveal from '../components/Reveal'

const ITEMS = [
  {
    icon: Banknote,
    title: 'PKR-first, always',
    body: 'Every price, budget preset, and plan is priced in Pakistani Rupees by default — no conversions to explain to shoppers.',
  },
  {
    icon: Landmark,
    title: 'JazzCash & EasyPaisa ready',
    body: 'Submit a transaction reference the way you already get paid — no international card gateway required.',
  },
  {
    icon: ShieldCheck,
    title: 'Admin-verified activations',
    body: 'Every manual payment is checked and approved by a real admin before a plan goes live — no surprises.',
  },
]

export default function LocalStrip() {
  return (
    <section className="lp-section lp-local">
      <div className="lp-container">
        <Reveal as="p" className="lp-eyebrow lp-eyebrow-light">
          Made for the local market
        </Reveal>
        <Reveal as="h2" delay={60} className="lp-section-title lp-section-title-light">
          Built around how Pakistani retailers actually get paid
        </Reveal>

        <div className="lp-local-grid">
          {ITEMS.map((item, i) => (
            <Reveal as="div" key={item.title} delay={100 + i * 90} className="lp-local-card">
              <span className="lp-local-icon">
                <item.icon size={20} strokeWidth={2} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
