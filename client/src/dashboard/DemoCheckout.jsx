import { useMemo, useState } from 'react'
import { Shield, Lock, CheckCircle } from 'lucide-react'

function digits(v) { return String(v || '').replace(/\D/g, '') }

function detectBrand(num) {
  const s = digits(num)
  if (/^3[47]/.test(s)) return 'amex'
  if (/^5[1-5]/.test(s)) return 'mastercard'
  if (/^4/.test(s)) return 'visa'
  return 'unknown'
}

function formatNumber(num) {
  const s = digits(num).slice(0, 16)
  if (detectBrand(s) === 'amex') {
    return [s.slice(0,4), s.slice(4,10), s.slice(10,15)].filter(Boolean).join(' ')
  }
  return s.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatExpiry(v) {
  const s = digits(v).slice(0, 4)
  if (s.length <= 2) return s
  return `${s.slice(0, 2)}/${s.slice(2)}`
}

export default function DemoCheckout({ plan, onClose, onPay }) {
  const [number, setNumber]   = useState('')
  const [name, setName]       = useState('')
  const [expiry, setExpiry]   = useState('')
  const [cvc, setCvc]         = useState('')
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy]       = useState(false)
  const [phase, setPhase]     = useState('form') // form | processing | success | error
  const [error, setError]     = useState('')
  const [receipt, setReceipt] = useState(null)

  const brand = detectBrand(number)
  const displayNum = formatNumber(number) || '•••• •••• •••• ••••'
  const last4 = digits(number).slice(-4)

  const brandLabel = useMemo(() => {
    if (brand === 'visa') return 'VISA'
    if (brand === 'mastercard') return 'mastercard'
    if (brand === 'amex') return 'AMEX'
    return 'CARD'
  }, [brand])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    setPhase('processing')
    try {
      // Brief pause for realism
      await new Promise((r) => setTimeout(r, 1400))
      const result = await onPay({
        number: digits(number),
        name,
        expiry,
        cvc: digits(cvc),
        plan: plan.id,
      })
      setReceipt(result.receipt || null)
      setPhase('success')
    } catch (err) {
      // BUGFIX: always reset phase to 'error' so the form doesn't stay stuck on 'processing'
      setError(err.message || 'Payment failed')
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pay-overlay" role="dialog" aria-modal="true">
      <div className="pay-shell">
        <button type="button" className="pay-close" onClick={onClose} aria-label="Close">×</button>

        {/* Left panel */}
        <div className="pay-left">
          <p className="pay-kicker">Secure Checkout</p>
          <h2>Complete payment</h2>
          <p className="pay-amount">
            PKR {Number(plan.price).toLocaleString()}
            <span> / {plan.name} · 30 days</span>
          </p>

          {/* Animated card */}
          <div className={`pay-card brand-${brand} ${flipped ? 'is-flipped' : ''}`}>
            <div className="pay-card-face pay-card-front">
              <div className="pay-card-top">
                <span className="pay-chip" aria-hidden="true" />
                <span className="pay-brand">{brandLabel}</span>
              </div>
              <div className="pay-card-number">{displayNum}</div>
              <div className="pay-card-bottom">
                <div>
                  <small>Cardholder</small>
                  <strong>{name || 'YOUR NAME'}</strong>
                </div>
                <div>
                  <small>Expires</small>
                  <strong>{expiry || 'MM/YY'}</strong>
                </div>
              </div>
            </div>
            <div className="pay-card-face pay-card-back">
              <div className="pay-magstrip" />
              <div className="pay-cvc-box">
                <small>CVC</small>
                <strong>{cvc ? '•'.repeat(Math.min(cvc.length, 4)) : '•••'}</strong>
              </div>
            </div>
          </div>

          {/* Trust badges — no "Demo" word */}
          <div className="pay-trust">
            <span><Lock size={11} /> 256-bit TLS</span>
            <span><Shield size={11} /> Secure checkout</span>
            <span><CheckCircle size={11} /> Instant activation</span>
          </div>
        </div>

        {/* Right panel */}
        <div className="pay-right">
          {phase === 'processing' && (
            <div className="pay-status">
              <div className="pay-spinner" />
              <h3>Authorizing payment…</h3>
              <p>Contacting issuing bank</p>
            </div>
          )}

          {phase === 'success' && (
            <div className="pay-status ok">
              <div className="pay-check">✓</div>
              <h3>Payment successful</h3>
              <p>
                {receipt?.brand || 'Card'} •••• {receipt?.last4 || last4} charged PKR{' '}
                {Number(receipt?.amount || plan.price).toLocaleString()}
              </p>
              <p className="muted tiny">Your plan is now active for 30 days.</p>
              <button type="button" className="btn" onClick={onClose}>
                Back to billing
              </button>
            </div>
          )}

          {(phase === 'form' || phase === 'error') && (
            <form className="pay-form" onSubmit={submit}>
              <h3>Card details</h3>
              {error && <p className="form-error">{error}</p>}

              <label>
                Card number
                <input
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="•••• •••• •••• ••••"
                  value={formatNumber(number)}
                  onChange={(e) => setNumber(digits(e.target.value).slice(0, 16))}
                  onFocus={() => setFlipped(false)}
                  required
                />
              </label>
              <label>
                Name on card
                <input
                  autoComplete="cc-name"
                  placeholder="Name as on card"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFlipped(false)}
                  required
                />
              </label>
              <div className="pay-row">
                <label>
                  Expiry
                  <input
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    onFocus={() => setFlipped(false)}
                    required
                  />
                </label>
                <label>
                  Security code
                  <input
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder={brand === 'amex' ? '1234' : '123'}
                    value={cvc}
                    maxLength={brand === 'amex' ? 4 : 3}
                    onChange={(e) => setCvc(digits(e.target.value).slice(0, 4))}
                    onFocus={() => setFlipped(true)}
                    onBlur={() => setFlipped(false)}
                    required
                  />
                </label>
              </div>

              <button className="btn pay-submit" type="submit" disabled={busy}>
                {busy ? 'Processing…' : `Pay PKR ${Number(plan.price).toLocaleString()}`}
              </button>

              <p className="muted tiny" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                Your card details are processed securely. Plan activates instantly on success.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
