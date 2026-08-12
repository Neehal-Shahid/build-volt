import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Reveal from '../components/Reveal'

export default function FinalCta({ isLoggedIn }) {
  return (
    <section className="lp-section">
      <div className="lp-container">
        <Reveal className="lp-cta-banner">
          <div className="lp-cta-glow" aria-hidden="true" />
          <h2>Ready to help every shopper find their perfect build?</h2>
          <p>Set up your catalog and widget today — it takes less time than writing one product description.</p>
          <div className="lp-cta-actions">
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
            <span className="lp-cta-note">No credit card required</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
