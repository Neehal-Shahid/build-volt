import { useEffect, useState } from 'react'
import { Database, Trash2, RefreshCw, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminActivity } from './activityLog'
import { useToast } from './useToast'
import { ToastArea } from './adminUi'

function CountRow({ label, value, warn }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{label}</span>
      <span className={`sd-badge ${warn && value > 0 ? 'amber' : 'blue'}`}>{value ?? '—'}</span>
    </div>
  )
}

export default function AdminDbHealth() {
  const { token } = useAdminAuth()
  const { toasts, toast } = useToast()
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await api('/api/admin/db-audit', { token })
      setAudit(r)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  async function cleanup(what) {
    const labels = {
      tokens: 'expired tokens',
      orphans: 'orphan records',
      pending_signups: 'old pending signups (>7 days)',
      email_log: 'email log entries (>10 days)',
      closed_tickets: 'closed tickets (>7 days)',
      all: 'everything listed above',
    }
    if (!window.confirm(`Clean ${labels[what]}?\n\nThis cannot be undone.`)) return
    setBusy(true)
    try {
      const r = await api('/api/admin/db-cleanup', { method: 'POST', token, body: { what } })
      logAdminActivity('db_cleanup', what)
      toast(`Cleaned — ${r.deleted ?? 0} row(s) removed`, 'success')
      await load()
    } catch (err) { toast(err.message, 'error') }
    finally { setBusy(false) }
  }

  const counts = audit?.counts || {}
  const orphans = audit?.orphans || {}

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">DB Health</h2>
          <p className="ad-page-desc">Audit table row counts, orphaned records, and expired tokens.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={load}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="ad-notice info" style={{ marginBottom: '1.25rem' }}>
        <Info size={14} style={{ flex: 'none' }} />
        <span>
          Drip emails run automatically only when <code>CRON_ENABLED=true</code> is set in the
          server environment. Use <strong>Run drip now</strong> in Communications to trigger manually.
        </span>
      </div>

      {loading ? (
        <div>
          <div className="sd-skel sd-skel-card" />
          <div className="sd-skel sd-skel-card" style={{ marginTop: '1rem' }} />
        </div>
      ) : (
        <>
          {/* Table counts */}
          <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
            <div className="sd-card-title"><Database size={17} /> Table Row Counts</div>
            {Object.entries(counts).map(([table, count]) => (
              <CountRow key={table} label={table} value={count} />
            ))}
          </div>

          {/* Orphans */}
          <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
            <div className="sd-card-title">
              <AlertTriangle size={17} />
              Orphans &amp; Expired Tokens
              {(orphans.products > 0 || orphans.recommendations > 0 || orphans.expiredTokens > 0) && (
                <span className="sd-badge amber" style={{ marginLeft: '0.5rem' }}>attention</span>
              )}
            </div>
            <CountRow label="Orphan products (no store)" value={orphans.products} warn />
            <CountRow label="Orphan recommendations (no store)" value={orphans.recommendations} warn />
            <CountRow label="Expired tokens" value={orphans.expiredTokens} warn />
          </div>

          {/* Cleanup actions */}
          <div className="sd-card">
            <div className="sd-card-title"><Trash2 size={17} /> Cleanup Actions</div>

            <div className="ad-notice info" style={{ marginBottom: '1rem' }}>
              <CheckCircle size={14} style={{ flex: 'none' }} />
              <span>
                "Clean all" will also purge email logs older than 10 days and
                closed support tickets older than 7 days.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              {[
                { what: 'tokens',          label: 'Expired tokens' },
                { what: 'orphans',         label: 'Orphan records' },
                { what: 'pending_signups', label: 'Old signups (>7d)' },
                { what: 'email_log',       label: 'Email log (>10d)' },
                { what: 'closed_tickets',  label: 'Closed tickets (>7d)' },
              ].map(({ what, label }) => (
                <button key={what} type="button" className="btn btn-ghost" disabled={busy}
                  onClick={() => cleanup(what)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-start' }}>
                  <Trash2 size={13} /> {label}
                </button>
              ))}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
            <button type="button" className="btn" disabled={busy}
              onClick={() => cleanup('all')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trash2 size={15} /> {busy ? 'Cleaning…' : 'Clean all'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
