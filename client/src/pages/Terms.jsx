import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const styles = `
  .legal-page {
    min-height: 100vh;
    background: #f8fafc;
    padding: 3rem 1rem;
    font-family: system-ui, -apple-system, sans-serif;
    color: #0A1A2D;
  }
  .legal-container {
    max-width: 680px;
    margin: 0 auto;
    background: #fff;
    border-radius: 12px;
    padding: 2.5rem 2rem;
    box-shadow: 0 1px 4px rgba(10,26,45,0.08);
  }
  .legal-back {
    display: inline-block;
    font-size: 0.875rem;
    color: #64748b;
    text-decoration: none;
    margin-bottom: 2rem;
  }
  .legal-back:hover { color: #2A5EE8; }
  .legal-container h1 {
    font-size: 1.875rem;
    font-weight: 700;
    color: #0A1A2D;
    margin: 0 0 0.375rem;
  }
  .legal-updated {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0 0 2.25rem;
  }
  .legal-container h2 {
    font-size: 1.0625rem;
    font-weight: 600;
    color: #0A1A2D;
    margin: 2rem 0 0.5rem;
  }
  .legal-container p {
    font-size: 0.9375rem;
    line-height: 1.7;
    color: #334155;
    margin: 0 0 0.75rem;
  }
  .legal-container a {
    color: #2A5EE8;
    text-decoration: none;
  }
  .legal-container a:hover { text-decoration: underline; }
  .legal-footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e2e8f0;
    font-size: 0.875rem;
    color: #64748b;
  }
  .legal-footer a { color: #2A5EE8; }
`

export default function Terms() {
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
    <>
      <style>{styles}</style>
      <div className="legal-page">
        <div className="legal-container">
          <Link to="/" className="legal-back">← Back to home</Link>

          <h1>Terms of Service</h1>
          <p className="legal-updated">Last updated: August 2025</p>

          <h2>1. Service Description</h2>
          <p>
            BuildBot is an AI-powered PC build recommendation widget designed for
            WooCommerce stores operating in Pakistan. The service includes a hosted
            embeddable widget, an AI recommendation engine, and a store management
            dashboard. By creating an account you agree to these terms in full.
          </p>

          <h2>2. Trial &amp; Subscription</h2>
          <p>
            New accounts receive a {trialDays}-day free trial with full access to all
            features. No credit card is required during the trial. After the trial
            period ends, a paid subscription plan is required to keep the widget
            active and serving recommendations to shoppers. Plans are billed
            manually via JazzCash or EasyPaisa and activated by admin approval.
          </p>

          <h2>3. Payment Terms</h2>
          <p>
            All payments are non-refundable once manually approved and the
            subscription period has been activated. A payment confirmation email
            will be sent by the BuildBot admin team upon successful activation.
            BuildBot reserves the right to suspend or terminate service for
            accounts with outstanding or failed payments.
          </p>

          <h2>4. Account Responsibilities</h2>
          <p>
            You are responsible for maintaining the security of your login
            credentials and for keeping your product catalog accurate and
            up-to-date. You agree not to use BuildBot to present misleading,
            fraudulent, or deceptive product recommendations to shoppers. Any
            misuse may result in immediate account suspension.
          </p>

          <h2>5. Service Availability</h2>
          <p>
            BuildBot makes reasonable efforts to maintain high uptime and service
            reliability but does not guarantee 100% availability. Scheduled
            maintenance windows may cause brief, temporary interruptions. We will
            endeavour to notify affected stores in advance when possible.
          </p>

          <h2>6. Termination</h2>
          <p>
            Either party may terminate the account at any time. Upon termination,
            your store data (product catalog, widget configuration, and usage
            history) will be retained for 30 days to allow for any data export
            requests, after which it will be permanently and irreversibly deleted.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            BuildBot and its operators shall not be liable for any indirect,
            incidental, special, or consequential damages arising out of or in
            connection with your use of the service, including but not limited to
            lost revenue, lost profits, or data loss, even if advised of the
            possibility of such damages.
          </p>

          <h2>8. Governing Law</h2>
          <p>
            These Terms of Service are governed by and construed in accordance
            with the laws of the Islamic Republic of Pakistan. Any disputes arising
            under these terms shall be subject to the exclusive jurisdiction of the
            courts of Pakistan.
          </p>

          <h2>9. Contact</h2>
          <p>
            If you have any questions about these Terms of Service, please contact
            us at{' '}
            <a href="mailto:workwithneehal@gmail.com">workwithneehal@gmail.com</a>.
          </p>

          <div className="legal-footer">
            <Link to="/privacy">Privacy Policy</Link>
            {' · '}
            <Link to="/">Back to home</Link>
          </div>
        </div>
      </div>
    </>
  )
}
