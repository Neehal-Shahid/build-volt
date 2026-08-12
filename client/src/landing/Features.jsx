import { BarChart3, Blocks, Cpu, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import Reveal from '../components/Reveal'

const FEATURES = [
  {
    icon: Cpu,
    title: 'Catalog-aware recommendations',
    body: 'Every build is assembled live from your own products and stock levels — never a generic parts list from the internet.',
  },
  {
    icon: Blocks,
    title: 'One-line embed',
    body: 'Paste a single script tag and the widget appears on your storefront. No developer, no theme changes.',
  },
  {
    icon: RefreshCw,
    title: 'WooCommerce sync',
    body: 'Connect your WooCommerce store and BuildBot keeps pricing, stock, and categories in sync automatically.',
  },
  {
    icon: Wallet,
    title: 'Budget-first matching',
    body: 'Shoppers pick a budget and a purpose — BuildBot handles the trade-offs and keeps every build within reach.',
  },
  {
    icon: BarChart3,
    title: 'Built-in analytics',
    body: 'See which budgets, purposes, and builds get the most traction, right from your store dashboard.',
  },
  {
    icon: ShieldCheck,
    title: 'Full account control',
    body: 'Manage plans, billing, widget branding, and support requests from a single, focused dashboard.',
  },
]

export default function Features() {
  return (
    <section id="features" className="lp-section">
      <div className="lp-container">
        <Reveal as="p" className="lp-eyebrow">
          Why BuildBot
        </Reveal>
        <Reveal as="h2" delay={60} className="lp-section-title">
          Everything you need to sell PC parts with confidence
        </Reveal>
        <Reveal as="p" delay={100} className="lp-section-subtitle">
          BuildBot replaces the guesswork of PC building with a guided,
          on-brand experience — built specifically for parts retailers.
        </Reveal>

        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.title}
              as="article"
              delay={i * 70}
              className="lp-feature-card"
            >
              <span className="lp-feature-icon">
                <f.icon size={22} strokeWidth={2} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
