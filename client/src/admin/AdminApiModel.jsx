import { useEffect, useState } from 'react'
import {
  Bot, Zap, DollarSign, CheckCircle, Save, Info, TrendingUp
} from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useToast } from './useToast'
import { ToastArea } from './adminUi'

// Known Anthropic models the user can select from
const KNOWN_MODELS = [
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    tags: [{ label: '⚡ Fastest', cls: 'fast' }, { label: '$ Cheapest', cls: 'cheap' }],
    desc: 'Best for high-volume, simple recommendations.',
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    tags: [{ label: '⚖ Balanced', cls: 'balanced' }, { label: '★ Recommended', cls: 'recommended' }],
    desc: 'Best quality-to-cost ratio for BuildBot.',
  },
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    tags: [{ label: '🧠 Smartest', cls: 'smart' }, { label: '$$ Expensive', cls: 'expensive' }],
    desc: 'Maximum reasoning power. Use sparingly.',
  },
  {
    id: '__custom__',
    name: 'Custom',
    tags: [{ label: 'Manual ID', cls: '' }],
    desc: 'Enter any Anthropic model ID manually.',
  },
]

export default function AdminApiModel() {
  const { token } = useAdminAuth()
  const { toasts, toast } = useToast()
  const [usage, setUsage] = useState(null)
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5')
  const [customModelId, setCustomModelId] = useState('')
  const [form, setForm] = useState({
    max_tokens: '4096',
    limit_starter: '500',
    limit_growth: '2000',
    limit_pro: '5000',
    trial_daily_limit: '3',
    usd_to_pkr: '280',
    product_limit_trial: '30',
    product_limit_starter: '200',
    product_limit_growth: '1000',
    product_limit_pro: '5000',
  })
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const res = await api('/api/admin/api-usage', { token })
      setUsage(res.usage)
      const c = res.config || {}
      const m = c.anthropic_model || 'claude-sonnet-4-5'
      const isKnown = KNOWN_MODELS.slice(0, -1).some((x) => x.id === m)
      if (isKnown) {
        setSelectedModel(m)
      } else {
        setSelectedModel('__custom__')
        setCustomModelId(m)
      }
      setForm({
        max_tokens: String(c.max_tokens || '4096'),
        limit_starter: String(c.limit_starter || '500'),
        limit_growth: String(c.limit_growth || '2000'),
        limit_pro: String(c.limit_pro || '5000'),
        trial_daily_limit: String(c.trial_daily_limit || '3'),
        usd_to_pkr: String(c.usd_to_pkr || '280'),
        product_limit_trial: String(c.product_limit_trial || '30'),
        product_limit_starter: String(c.product_limit_starter || '200'),
        product_limit_growth: String(c.product_limit_growth || '1000'),
        product_limit_pro: String(c.product_limit_pro || '5000'),
      })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  useEffect(() => { load() }, [token])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const modelId = selectedModel === '__custom__' ? customModelId.trim() : selectedModel
      if (!modelId) { toast('Choose or enter a model ID', 'error'); setBusy(false); return }
      await api('/api/admin/platform-config', {
        method: 'POST', token,
        body: { ...form, anthropic_model: modelId },
      })
      toast('Model & limits saved', 'success')
      await load()
    } catch (err) { toast(err.message, 'error') }
    finally { setBusy(false) }
  }

  function field(key) {
    return {
      value: form[key],
      onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    }
  }

  const activeModelId = selectedModel === '__custom__' ? customModelId : selectedModel

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">API &amp; Model</h2>
          <p className="ad-page-desc">Anthropic AI usage stats, model selector, and per-plan limits.</p>
        </div>
      </div>

      {/* Usage stat cards */}
      <div className="sd-stats-grid">
        <div className="sd-stat-card">
          <span className="sd-stat-icon blue"><Zap size={20} strokeWidth={1.75} /></span>
          <div className="sd-stat-body">
            <span className="sd-stat-label">Total API Calls</span>
            <div className="sd-stat-value">{usage?.calls ?? '—'}</div>
          </div>
        </div>
        <div className="sd-stat-card">
          <span className="sd-stat-icon amber"><DollarSign size={20} strokeWidth={1.75} /></span>
          <div className="sd-stat-body">
            <span className="sd-stat-label">Estimated Cost (USD)</span>
            <div className="sd-stat-value">
              {usage ? `$${usage.costUsd.toFixed(4)}` : '—'}
            </div>
          </div>
        </div>
        <div className="sd-stat-card">
          <span className="sd-stat-icon purple"><TrendingUp size={20} strokeWidth={1.75} /></span>
          <div className="sd-stat-body">
            <span className="sd-stat-label">Cost in PKR</span>
            <div className="sd-stat-value">
              {usage ? `PKR ${Math.round(usage.costPkr).toLocaleString()}` : '—'}
            </div>
          </div>
        </div>
        <div className="sd-stat-card">
          <span className="sd-stat-icon green"><DollarSign size={20} strokeWidth={1.75} /></span>
          <div className="sd-stat-body">
            <span className="sd-stat-label">Est. Profit (PKR)</span>
            <div className="sd-stat-value">
              {usage ? `PKR ${Math.round(usage.estimatedProfitPkr).toLocaleString()}` : '—'}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={save}>
        {/* Model selector */}
        <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
          <div className="sd-card-title">
            <Bot size={17} />
            AI Model Selection
          </div>

          <div className="ad-notice info">
            <Info size={15} style={{ flex: 'none', marginTop: 1 }} />
            <span>
              Selected model applies when <code>ANTHROPIC_API_KEY</code> is configured.
              While <code>TEST_MODE=true</code>, fake builds are returned regardless of model choice.
            </span>
          </div>

          <div className="ad-model-grid">
            {KNOWN_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`ad-model-card ${selectedModel === m.id ? 'selected' : ''}`}
                onClick={() => setSelectedModel(m.id)}
              >
                <span className="ad-model-check">✓</span>
                <span className="ad-model-card-name">{m.name}</span>
                <span className="ad-model-card-id">
                  {m.id === '__custom__' ? 'custom-model-id' : m.id}
                </span>
                <div className="ad-model-card-meta">
                  {m.tags.map((t) => (
                    <span key={t.label} className={`ad-model-card-tag ${t.cls}`}>{t.label}</span>
                  ))}
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                  {m.desc}
                </p>
              </button>
            ))}
          </div>

          {selectedModel === '__custom__' && (
            <div className="sd-field" style={{ marginTop: '0.5rem' }}>
              <label className="sd-field-label">Custom Model ID</label>
              <input
                type="text"
                value={customModelId}
                onChange={(e) => setCustomModelId(e.target.value)}
                placeholder="e.g. claude-3-5-haiku-20241022"
                required={selectedModel === '__custom__'}
              />
            </div>
          )}

          {activeModelId && selectedModel !== '__custom__' && (
            <p className="muted tiny" style={{ marginTop: '0.5rem' }}>
              Active: <code>{activeModelId}</code>
            </p>
          )}
        </div>

        {/* Limits */}
        <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
          <div className="sd-card-title">
            <Zap size={17} />
            Token &amp; Plan Limits
          </div>

          <div className="sd-field">
            <label className="sd-field-label">Max Tokens per Request</label>
            <input type="number" min="256" max="8192" {...field('max_tokens')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="sd-field">
              <label className="sd-field-label">Monthly Limit — Starter</label>
              <input type="number" min="1" {...field('limit_starter')} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Monthly Limit — Growth</label>
              <input type="number" min="1" {...field('limit_growth')} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Monthly Limit — Pro</label>
              <input type="number" min="1" {...field('limit_pro')} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Trial Daily Limit</label>
              <input type="number" min="1" {...field('trial_daily_limit')} />
            </div>
          </div>
        </div>

        {/* Product catalog limits */}
        <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
          <div className="sd-card-title">
            <Zap size={17} />
            Product Catalog Limits
          </div>
          <p className="muted tiny" style={{ marginTop: 0 }}>
            Max products a store can hold, by plan. Applies to manual/CSV catalogs only — WooCommerce sync has its own 5,000-product cap.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="sd-field">
              <label className="sd-field-label">Trial</label>
              <input type="number" min="1" {...field('product_limit_trial')} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Starter</label>
              <input type="number" min="1" {...field('product_limit_starter')} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Growth</label>
              <input type="number" min="1" {...field('product_limit_growth')} />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Pro</label>
              <input type="number" min="1" {...field('product_limit_pro')} />
            </div>
          </div>
        </div>

        {/* Currency */}
        <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
          <div className="sd-card-title">
            <DollarSign size={17} />
            Currency &amp; Billing Rate
          </div>
          <div className="sd-field">
            <label className="sd-field-label">USD → PKR Exchange Rate</label>
            <input type="number" min="1" {...field('usd_to_pkr')} />
          </div>
          <p className="muted tiny">
            Used to estimate PKR cost of Anthropic API calls in the stats above.
          </p>
        </div>

        <button className="btn" type="submit" disabled={busy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <Save size={15} />
          {busy ? 'Saving…' : 'Save Model & Limits'}
        </button>
      </form>
    </div>
  )
}
