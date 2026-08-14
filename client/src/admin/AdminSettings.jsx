import { useEffect, useState } from 'react'
import {
  Settings, User, Lock, CreditCard, Wrench, Save,
  AlertTriangle, Hourglass, Layers
} from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useToast } from './useToast'
import { ToastArea } from './adminUi'

const PLAN_META = [
  { key: 'starter', label: 'Starter' },
  { key: 'growth', label: 'Growth' },
  { key: 'pro', label: 'Pro' },
]

export default function AdminSettings() {
  const { token, admin } = useAdminAuth()
  const { toasts, toast } = useToast()

  // Account
  const [name, setName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busyProfile, setBusyProfile] = useState(false)
  const [busyPw, setBusyPw] = useState(false)

  // Payment methods
  const [paymentMode, setPaymentMode] = useState('both')
  const [paymentNumber, setPaymentNumber] = useState('')
  const [busyPayment, setBusyPayment] = useState(false)

  // Trial — every knob that affects what a trial store gets, in one place
  const [trialDays, setTrialDays] = useState('14')
  const [trialDailyLimit, setTrialDailyLimit] = useState('3')
  const [trialProductLimit, setTrialProductLimit] = useState('30')
  const [busyTrial, setBusyTrial] = useState(false)

  // Paid plans — price + recommendation limit + product limit, per plan
  const [plans, setPlans] = useState({
    starter: { price: '2999', recLimit: '500', productLimit: '200' },
    growth:  { price: '4999', recLimit: '2000', productLimit: '1000' },
    pro:     { price: '7999', recLimit: '5000', productLimit: '5000' },
  })
  const [busyPlans, setBusyPlans] = useState(false)

  // Platform & maintenance
  const [maintenance, setMaintenance] = useState(false)
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
        setTrialDailyLimit(String(c.trial_daily_limit || '3'))
        setTrialProductLimit(String(c.product_limit_trial || '30'))
        setPlans({
          starter: {
            price: String(c.price_starter || '2999'),
            recLimit: String(c.limit_starter || '500'),
            productLimit: String(c.product_limit_starter || '200'),
          },
          growth: {
            price: String(c.price_growth || '4999'),
            recLimit: String(c.limit_growth || '2000'),
            productLimit: String(c.product_limit_growth || '1000'),
          },
          pro: {
            price: String(c.price_pro || '7999'),
            recLimit: String(c.limit_pro || '5000'),
            productLimit: String(c.product_limit_pro || '5000'),
          },
        })
        setMaintenance(c.maintenance_mode === '1')
      } catch (err) {
        toast(err.message, 'error')
      }
    })()
    return () => { cancelled = true }
  }, [token])

  async function saveProfile(e) {
    e.preventDefault()
    setBusyProfile(true)
    try {
      await api('/api/admin/profile', { method: 'PUT', token, body: { name } })
      toast('Profile saved', 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyProfile(false) }
  }

  async function savePassword(e) {
    e.preventDefault()
    setBusyPw(true)
    try {
      await api('/api/admin/password', { method: 'PUT', token, body: { currentPassword, newPassword } })
      setCurrentPassword('')
      setNewPassword('')
      toast('Password updated', 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyPw(false) }
  }

  async function savePayment(e) {
    e.preventDefault()
    setBusyPayment(true)
    try {
      await api('/api/admin/platform-config', {
        method: 'POST', token,
        body: { payment_mode: paymentMode, payment_number: paymentNumber },
      })
      toast('Payment method saved', 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyPayment(false) }
  }

  async function saveTrial(e) {
    e.preventDefault()
    setBusyTrial(true)
    try {
      await api('/api/admin/platform-config', {
        method: 'POST', token,
        body: {
          trial_days: trialDays,
          trial_daily_limit: trialDailyLimit,
          product_limit_trial: trialProductLimit,
        },
      })
      toast('Trial settings saved', 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyTrial(false) }
  }

  function setPlanField(planKey, field, value) {
    setPlans((p) => ({ ...p, [planKey]: { ...p[planKey], [field]: value } }))
  }

  async function savePlans(e) {
    e.preventDefault()
    setBusyPlans(true)
    try {
      await api('/api/admin/platform-config', {
        method: 'POST', token,
        body: {
          price_starter: plans.starter.price,
          price_growth: plans.growth.price,
          price_pro: plans.pro.price,
          limit_starter: plans.starter.recLimit,
          limit_growth: plans.growth.recLimit,
          limit_pro: plans.pro.recLimit,
          product_limit_starter: plans.starter.productLimit,
          product_limit_growth: plans.growth.productLimit,
          product_limit_pro: plans.pro.productLimit,
        },
      })
      toast('Plan pricing & limits saved', 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyPlans(false) }
  }

  async function savePlatform(e) {
    e.preventDefault()
    setBusyPlatform(true)
    try {
      await api('/api/admin/platform-config', {
        method: 'POST', token,
        body: { maintenance_mode: maintenance ? '1' : '0' },
      })
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
          <p className="ad-page-desc">Every business setting lives here — your account, what stores get on trial, what paid plans include, and how payments work. AI model configuration is in the API &amp; Model tab.</p>
        </div>
      </div>

      {/* ── Account ── */}
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

      {/* ── Trial Settings — the ONE place everything about trials lives ── */}
      <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
        <div className="sd-card-title">
          <Hourglass size={17} />
          Trial Settings
        </div>
        <p className="muted tiny" style={{ marginTop: 0, marginBottom: '1rem' }}>
          Everything a new store gets during its free trial. Changing these only affects stores that sign up <em>after</em> you save — trials already running keep the length they were promised.
        </p>
        <form className="sd-form" onSubmit={saveTrial}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="sd-field">
              <label className="sd-field-label">Trial length (days)</label>
              <input type="number" min="1" value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Recommendations / day</label>
              <input type="number" min="1" value={trialDailyLimit}
                onChange={(e) => setTrialDailyLimit(e.target.value)} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Products allowed</label>
              <input type="number" min="1" value={trialProductLimit}
                onChange={(e) => setTrialProductLimit(e.target.value)} />
            </div>
          </div>
          <button className="btn" type="submit" disabled={busyTrial}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Save size={14} /> {busyTrial ? 'Saving…' : 'Save trial settings'}
          </button>
        </form>
      </div>

      {/* ── Paid Plans — price + both limits, side by side per plan ── */}
      <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
        <div className="sd-card-title">
          <Layers size={17} />
          Paid Plans
        </div>
        <p className="muted tiny" style={{ marginTop: 0, marginBottom: '1rem' }}>
          Price, monthly recommendation limit, and product-catalog limit for each plan — grouped together so you can see what a store actually gets for the price.
        </p>
        <form className="sd-form" onSubmit={savePlans}>
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th></th>
                  {PLAN_META.map((p) => <th key={p.key}>{p.label}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="muted tiny">Price (PKR / month)</td>
                  {PLAN_META.map((p) => (
                    <td key={p.key}>
                      <div className="sd-field" style={{ marginBottom: 0 }}>
                        <input type="text" value={plans[p.key].price}
                          onChange={(e) => setPlanField(p.key, 'price', e.target.value)} />
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="muted tiny">Recommendations / month</td>
                  {PLAN_META.map((p) => (
                    <td key={p.key}>
                      <div className="sd-field" style={{ marginBottom: 0 }}>
                        <input type="number" min="1" value={plans[p.key].recLimit}
                          onChange={(e) => setPlanField(p.key, 'recLimit', e.target.value)} />
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="muted tiny">Products allowed</td>
                  {PLAN_META.map((p) => (
                    <td key={p.key}>
                      <div className="sd-field" style={{ marginBottom: 0 }}>
                        <input type="number" min="1" value={plans[p.key].productLimit}
                          onChange={(e) => setPlanField(p.key, 'productLimit', e.target.value)} />
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <button className="btn" type="submit" disabled={busyPlans}
            style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Save size={14} /> {busyPlans ? 'Saving…' : 'Save plan pricing & limits'}
          </button>
        </form>
      </div>

      {/* ── Payment Methods ── */}
      <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
        <div className="sd-card-title">
          <CreditCard size={17} />
          Payment Methods
        </div>
        <form className="sd-form" onSubmit={savePayment}>
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

          <button className="btn" type="submit" disabled={busyPayment}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Save size={14} /> {busyPayment ? 'Saving…' : 'Save payment method'}
          </button>
        </form>
      </div>

      {/* ── Platform & Maintenance ── */}
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

          <button className="btn" type="submit" disabled={busyPlatform}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Settings size={14} /> {busyPlatform ? 'Saving…' : 'Save platform settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
