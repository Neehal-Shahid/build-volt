import { Code2, PackageCheck, Palette, UserPlus } from 'lucide-react'
import Reveal from '../components/Reveal'

const STEPS = [
  {
    icon: UserPlus,
    title: 'Sign up & add your catalog',
    body: 'Create your account, then upload a CSV or connect WooCommerce — your products sync in minutes.',
  },
  {
    icon: Palette,
    title: 'Customize your widget',
    body: 'Match your brand color, currency, welcome message, and budget presets to fit your store.',
  },
  {
    icon: Code2,
    title: 'Embed it on your site',
    body: 'Paste one script tag, or let the WooCommerce plugin inject it automatically. No code required.',
  },
  {
    icon: PackageCheck,
    title: 'Shoppers get instant builds',
    body: 'Budget and purpose in, three ready-to-buy builds out — assembled from products you already stock.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="lp-section lp-section-muted">
      <div className="lp-container">
        <Reveal as="p" className="lp-eyebrow">
          How it works
        </Reveal>
        <Reveal as="h2" delay={60} className="lp-section-title">
          Live on your store in four simple steps
        </Reveal>
        <Reveal as="p" delay={100} className="lp-section-subtitle">
          No developer required — from signup to your first recommendation
          in one sitting.
        </Reveal>

        <div className="lp-steps">
          {STEPS.map((step, i) => (
            <Reveal as="div" key={step.title} delay={i * 90} className="lp-step">
              <div className="lp-step-top">
                <span className="lp-step-icon">
                  <step.icon size={20} strokeWidth={2} />
                </span>
                <span className="lp-step-number">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
