import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { api } from '../lib/api'
import Reveal from '../components/Reveal'

const FALLBACK = {
  trialDays: 14,
  trialDailyLimit: 3,
  plans: [
    { id: 'starter', name: 'Starter', price: 2999, limit: 500, blurb: 'For small shops getting started' },
    { id: 'growth', name: 'Growth', price: 4999, limit: 2000, blurb: 'More recommendations for busy stores' },
    { id: 'pro', name: 'Pro', price: 7999, limit: 5000, blurb: 'Highest monthly volume' },
  ],
}

function formatPkr(n) {
  return `Rs ${Number(n || 0).toLocaleString('en-PK')}`
}

export default function Pricing() {
  const [data, setData] = useState(FALLBACK)

  useEffect(() => {
    let cancelled = false
    api('/api/plans')
      .then((res) => {
        if (cancelled || !res?.plans?.length) return
        setData({
          trialDays: res.trialDays ?? FALLBACK.trialDays,
          trialDailyLimit: res.trialDailyLimit ?? FALLBACK.trialDailyLimit,
          plans: res.plans,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const featuredId = data.plans[Math.floor(data.plans.length / 2)]?.id

  return (
    <section id="pricing" className="lp-section">
      <div className="lp-container">
        <Reveal as="p" className="lp-eyebrow">
          Pricing
        </Reveal>
        <Reveal as="h2" delay={60} className="lp-section-title">
          Start free, upgrade when you're ready
        </Reveal>
        <Reveal as="p" delay={100} className="lp-section-subtitle">
          Every plan includes the widget, dashboard, and analytics. Every
          new store gets a {data.trialDays}-day free trial with up to{' '}
          {data.trialDailyLimit} recommendations a day — no card required.
        </Reveal>

        <div className="lp-pricing-grid">
          <Reveal className="lp-price-card">
            <span className="lp-price-name">Free Trial</span>
            <div className="lp-price-amount">
              Rs 0<small>/ {data.trialDays} days</small>
            </div>
            <p className="lp-price-blurb">
              Full access while you set up your catalog and widget.
            </p>
            <ul>
              <li>
                <Check size={15} strokeWidth={3} /> Up to {data.trialDailyLimit}{' '}
                recommendations / day
              </li>
              <li>
                <Check size={15} strokeWidth={3} /> Manual or WooCommerce catalog
              </li>
              <li>
                <Check size={15} strokeWidth={3} /> Full widget customization
              </li>
            </ul>
            <Link className="btn btn-ghost" to="/signup">
              Start free trial
            </Link>
          </Reveal>

          {data.plans.map((plan, i) => (
            <Reveal
              key={plan.id}
              delay={(i + 1) * 80}
              className={`lp-price-card ${plan.id === featuredId ? 'is-featured' : ''}`}
            >
              {plan.id === featuredId && <span className="lp-price-badge">Most popular</span>}
              <span className="lp-price-name">{plan.name}</span>
              <div className="lp-price-amount">
                {formatPkr(plan.price)}
                <small>/ month</small>
              </div>
              <p className="lp-price-blurb">{plan.blurb}</p>
              <ul>
                <li>
                  <Check size={15} strokeWidth={3} /> Up to{' '}
                  {Number(plan.limit).toLocaleString()} recommendations / month
                </li>
                <li>
                  <Check size={15} strokeWidth={3} /> Full analytics dashboard
                </li>
                <li>
                  <Check size={15} strokeWidth={3} /> JazzCash / EasyPaisa billing
                </li>
              </ul>
              <Link className={`btn ${plan.id === featuredId ? '' : 'btn-ghost'}`} to="/signup">
                Get started
                <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
