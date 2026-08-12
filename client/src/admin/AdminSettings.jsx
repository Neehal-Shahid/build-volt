import { useEffect, useState } from 'react'
import {
  Settings, User, Lock, CreditCard, Wrench, Save,
  CheckCircle, AlertTriangle, DollarSign, Info
} from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminActivity } from './activityLog'
import { useToast } from './useToast'
import { ToastArea } from './adminUi'

export default function AdminSettings() {
  const { token, admin } = useAdminAuth()
  const { toasts, toast } = useToast()

  // Card A — Account
  const [name, setName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busyProfile, setBusyProfile] = useState(false)
  const [busyPw, setBusyPw] = useState(false)

  // Card B — Payment & Plans
  const [paymentMode, setPaymentMode] = useState('both')
  const [paymentNumber, setPaymentNumber] = useState('')
  const [trialDays, setTrialDays] = useState('14')
  const [prices, setPrices] = useState({ starter: '2999', growth: '4999', pro: '7999' })
  const [busyPayment, setBusyPayment] = useState(false)

  // Card C — Platform & Maintenance
  const [maintenance, setMaintenance] = useState(false)
  const [usdToPkr, setUsdToPkr] = useState('280')
  const [busyPlatform, setBusyPlatform] = useState(false)

  useEffect(() => {
    setName(admin?.name || '')
  }, [admin])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api('/api/admin/platform-config', { token })
        if (cancelled) return
        const c = data.config
        setPaymentMode(c.payment_mode || 'both')
        setPaymentNumber(c.payment_number || '')
        setTrialDays(String(c.trial_days || '14'))
        setPrices({
          starter: String(c.price_starter || '2999'),
          growth:  String(c.price_growth  || '4999'),
          pro:     String(c.price_pro     || '7999'),
        })
        setMaintenance(c.maintenance_mode === '1')
        setUsdToPkr(String(c.usd_to_pkr || '280'))
      } catch (err) {
        toast(err.message, 'error')
      }
    })()
    return () => { cancelled = true }
  }, [token])

  // --- Save profile ---
  async function saveProfile(e) {
    e.preventDefault()
    setBusyProfile(true)
    try {
      await api('/api/admin/profile', { method: 'PUT', token, body: { name } })
      logAdminActivity('admin_profile', name)
      toast('Profile saved', 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyProfile(false) }
  }

  // --- Change password ---
  async function savePassword(e) {
    e.preventDefault()
    setBusyPw(true)
    try {
      await api('/api/admin/password', { method: 'PUT', token, body: { currentPassword, newPassword } })
      logAdminActivity('admin_password', 'updated')
      setCurrentPassword('')
      setNewPassword('')
      toast('Password updated', 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyPw(false) }
  }

  // --- Save payment & plans ---
  async function savePayment(e) {
    e.preventDefault()
    setBusyPayment(true)
    try {
      await api('/api/admin/platform-config', {
        method: 'POST', token,
        body: {
          payment_mode: paymentMode,
          payment_number: paymentNumber,
          trial_days: trialDays,
          price_starter: prices.starter,
          price_growth:  prices.growth,
          price_pro:     prices.pro,
        },
      })
      logAdminActivity('payment_config', paymentMode)
      toast('Payment & plan settings saved', 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyPayment(false) }
  }

  // --- Save platform & maintenance ---
  async function savePlatform(e) {
    e.preventDefault()
    setBusyPlatform(true)
    try {
      await api('/api/admin/platform-config', {
        method: 'POST', token,
        body: {
          maintenance_mode: maintenance ? '1' : '0',
          usd_to_pkr: usdToPkr,
        },
      })
      logAdminActivity('platform_config', maintenance ? 'maintenance_on' : 'maintenance_off')
      toast(maintenance ? '⚠ Maintenance mode ON' : 'Platform settings saved', maintenance ? 'info' : 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyPlatform(false) }
  }

  const PAYMENT_MODES = [
    { value: 'demo',      label: 'Demo card only',           desc: 'Instant checkout activation — good for FYP demos' },
    { value: 'jazzcash',  label: 'JazzCash / EasyPaisa only', desc: 'Manual TID submission → admin approve' },
    { value: 'both',      label: 'Both methods',              desc: 'Recommended — lets users choose' },
  ]

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">Settings</h2>
          <p className="ad-page-desc">Manage your admin account, payment methods, and platform configuration.</p>
        </div>
      </div>

      {/* ── Card A: Account ── */}
      <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
        <div className="sd-card-title">
          <User size={17} />
          Admin Account
        </div>
        <p className="ad-section-eyebrow">Profile</p>
        <form className="sd-form" onSubmit={saveProfile}>
          <div className="sd-field">
            <label className="sd-field-label">Display Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your name" />
          </div>
          <p className="muted tiny">{admin?.email}</p>
          <button className="btn btn-ghost" type="submit" disabled={busyProfile}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Save size={14} /> {busyProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.25rem 0' }} />

        <p className="ad-section-eyebrow">Change Password</p>
        <form className="sd-form" onSubmit={savePassword}>
          <div className="sd-field">
            <label className="sd-field-label">Current Password</label>
            <input type="password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="sd-field">
            <label className="sd-field-label">New Password</label>
            <input type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <button className="btn btn-ghost" type="submit" disabled={busyPw}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Lock size={14} /> {busyPw ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      {/* ── Card B: Payment & Plans ── */}
      <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
        <div className="sd-card-title">
          <CreditCard size={17} />
          Payment Methods &amp; Plan Pricing
        </div>
        <form className="sd-form" onSubmit={savePayment}>
          <p className="ad-section-eyebrow">Payment Mode</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {PAYMENT_MODES.map((opt) => (
              <label key={opt.value}
                className={`ad-to-option ${paymentMode === opt.value ? 'selected' : ''}`}
                style={{ cursor: 'pointer' }}>
                <input type="radio" name="payment_mode" value={opt.value}
                  checked={paymentMode === opt.value}
                  onChange={() => setPaymentMode(opt.value)} />
                <div>
                  <div className="ad-to-option-label">{opt.label}</div>
                  <div className="ad-to-option-desc">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {(paymentMode === 'jazzcash' || paymentMode === 'both') && (
            <div className="sd-field">
              <label className="sd-field-label">JazzCash / EasyPaisa Number</label>
              <input type="text" value={paymentNumber}
                onChange={(e) => setPaymentNumber(e.target.value)}
                placeholder="03xxxxxxxxx" />
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
          <p className="ad-section-eyebrow">Trial &amp; Plan Prices (PKR)</p>

          <div className="sd-field">
            <label className="sd-field-label">Trial Period (days)</label>
            <input type="number" min="1" value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="sd-field">
              <label className="sd-field-label">Starter</label>
              <input type="text" value={prices.starter}
                onChange={(e) => setPrices((p) => ({ ...p, starter: e.target.value }))} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Growth</label>
              <input type="text" value={prices.growth}
                onChange={(e) => setPrices((p) => ({ ...p, growth: e.target.value }))} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Pro</label>
              <input type="text" value={prices.pro}
                onChange={(e) => setPrices((p) => ({ ...p, pro: e.target.value }))} />
            </div>
          </div>

          <button className="btn" type="submit" disabled={busyPayment}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Save size={14} /> {busyPayment ? 'Saving…' : 'Save payment & pricing'}
          </button>
        </form>
      </div>

      {/* ── Card C: Platform & Maintenance ── */}
      <div className="sd-card">
        <div className="sd-card-title">
          <Wrench size={17} />
          Platform &amp; Maintenance
        </div>
        <form className="sd-form" onSubmit={savePlatform}>
          {maintenance && (
            <div className="ad-maintenance-banner">
              <AlertTriangle size={20} />
              Maintenance mode is ON — all new AI recommendations are blocked for stores.
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
            <input type="checkbox" id="maint-mode"
              checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--blue)' }} />
            <span style={{ fontWeight: 700 }}>Enable Maintenance Mode</span>
          </label>
          <div className="ad-notice warning" style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={14} style={{ flex: 'none', marginTop: 1 }} />
            <span>When on, the recommendation engine returns an error to shoppers. Use only during database maintenance or emergencies.</span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
          <p className="ad-section-eyebrow">Currency Rate</p>
          <div className="sd-field">
            <label className="sd-field-label">USD → PKR Exchange Rate</label>
            <input type="number" min="1" value={usdToPkr}
              onChange={(e) => setUsdToPkr(e.target.value)} />
          </div>
          <p className="muted tiny">Used for API cost calculations in the API &amp; Model tab.</p>

          <button className="btn" type="submit" disabled={busyPlatform}
            style={{ marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Settings size={14} /> {busyPlatform ? 'Saving…' : 'Save platform settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
