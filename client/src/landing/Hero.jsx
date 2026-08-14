import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, PlayCircle, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import Reveal from '../components/Reveal'
import WidgetPreview from './WidgetPreview'

export default function Hero({ isLoggedIn }) {
  const [trialDays, setTrialDays] = useState(14)

  useEffect(() => {
    let cancelled = false
    api('/api/plans')
      .then((res) => {
        if (!cancelled && res?.trialDays) setTrialDays(res.trialDays)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="lp-hero">
      <div className="lp-hero-glow" aria-hidden="true" />
      <div className="lp-container lp-hero-inner">
        <div className="lp-hero-copy">
          <Reveal variant="up" className="lp-badge">
            <Sparkles size={14} strokeWidth={2.5} />
            Built for PC parts retailers in Pakistan
          </Reveal>

          <Reveal as="h1" variant="up" delay={80} className="lp-hero-title">
            Help every shopper build the right PC — automatically
          </Reveal>

          <Reveal as="p" variant="up" delay={140} className="lp-hero-subtitle">
            BuildBot turns your product catalog into an AI-powered widget.
            Shoppers share a budget and purpose, and get three ready-to-buy
            builds assembled from your live stock — no spec sheets, no back
            and forth.
          </Reveal>

          <Reveal variant="up" delay={200} className="lp-hero-actions">
            {isLoggedIn ? (
              <Link className="btn btn-lg" to="/dashboard">
                Open dashboard
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
            ) : (
              <Link className="btn btn-lg" to="/signup">
                Start your free trial
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
            )}
            <a className="btn btn-ghost btn-lg" href="#how-it-works">
              <PlayCircle size={18} strokeWidth={2.25} />
              See how it works
            </a>
          </Reveal>

          <Reveal variant="up" delay={260} className="lp-hero-trust">
            <span>{trialDays}-day free trial</span>
            <span className="lp-hero-trust-dot" />
            <span>No credit card required</span>
            <span className="lp-hero-trust-dot" />
            <span>Works with WooCommerce or any storefront</span>
          </Reveal>
        </div>

        <Reveal variant="scale" delay={160} className="lp-hero-visual">
          <div className="lp-hero-visual-decor lp-hero-decor-a" aria-hidden="true" />
          <div className="lp-hero-visual-decor lp-hero-decor-b" aria-hidden="true" />
          <WidgetPreview className="lp-hero-widget" />
        </Reveal>
      </div>
    </section>
  )
}
