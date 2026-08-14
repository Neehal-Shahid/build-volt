import { Link } from 'react-router-dom'

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
  .legal-container ul {
    margin: 0 0 0.75rem;
    padding-left: 1.5rem;
  }
  .legal-container ul li {
    font-size: 0.9375rem;
    line-height: 1.7;
    color: #334155;
    margin-bottom: 0.25rem;
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

export default function Privacy() {
  return (
    <>
      <style>{styles}</style>
      <div className="legal-page">
        <div className="legal-container">
          <Link to="/" className="legal-back">← Back to home</Link>

          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: August 2025</p>

          <h2>1. Data We Collect</h2>
          <p>When you create and use a BuildBot store account, we collect:</p>
          <ul>
            <li>Store email address and store name</li>
            <li>Product catalog data (names, categories, prices)</li>
            <li>Recommendation usage history and widget interaction counts</li>
            <li>Payment reference numbers (JazzCash / EasyPaisa transaction IDs — not card or account numbers)</li>
            <li>Widget configuration settings</li>
          </ul>

          <h2>2. How We Use Your Data</h2>
          <p>Your data is used exclusively to:</p>
          <ul>
            <li>Provide and power the AI recommendation widget on your store</li>
            <li>Send account, verification, and billing emails</li>
            <li>Display usage analytics and metrics in your store dashboard</li>
            <li>Improve the accuracy and relevance of the AI recommendation engine</li>
          </ul>
          <p>We do not sell, rent, or share your data with third parties for marketing purposes.</p>

          <h2>3. Data Storage</h2>
          <p>
            All store and account data is stored in a Turso (libSQL) cloud database.
            Data is encrypted at rest. Access to the database is restricted to
            authenticated BuildBot services and admin personnel only.
          </p>

          <h2>4. Third-Party Services</h2>
          <p>BuildBot relies on the following third-party services to operate:</p>
          <ul>
            <li>
              <strong>Resend</strong> (<a href="https://resend.com" target="_blank" rel="noreferrer">resend.com</a>)
              — used for transactional email delivery (verification codes, billing notices).
            </li>
            <li>
              <strong>Anthropic</strong> (<a href="https://anthropic.com" target="_blank" rel="noreferrer">anthropic.com</a>)
              — used for AI recommendation processing. Shopper inputs (budget, use-case,
              preferences) are sent to Anthropic's API in real time. Anthropic does not
              retain these queries after processing per their API data usage policy.
            </li>
          </ul>

          <h2>5. Cookies</h2>
          <p>
            BuildBot uses a single authentication token (JWT) stored in your
            browser's <code>localStorage</code> to keep you logged in to your store
            dashboard. We do not use tracking cookies, advertising cookies, or any
            third-party analytics cookies.
          </p>

          <h2>6. Data Retention</h2>
          <p>
            Your store data is retained for as long as your account is active. Upon
            account deletion or termination, all associated data is kept for 30 days
            (to allow for export requests) and then permanently deleted.
          </p>

          <h2>7. Your Rights</h2>
          <p>
            You have the right to request access to, correction of, or complete
            deletion of your account and all associated data at any time. To
            exercise this right, email us at{' '}
            <a href="mailto:workwithneehal@gmail.com">workwithneehal@gmail.com</a>{' '}
            from your registered store email address.
          </p>

          <h2>8. Contact</h2>
          <p>
            For any privacy-related questions or concerns, contact us at{' '}
            <a href="mailto:workwithneehal@gmail.com">workwithneehal@gmail.com</a>.
          </p>

          <div className="legal-footer">
            <Link to="/terms">Terms of Service</Link>
            {' · '}
            <Link to="/">Back to home</Link>
          </div>
        </div>
      </div>
    </>
  )
}
