import { Activity, RefreshCw, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useToast } from './useToast'
import { ToastArea, relTime } from './adminUi'

function actionLabel(action) {
  const map = {
    approve_payment:  '✅ Approved payment',
    reject_payment:   '❌ Rejected payment',
    disable_store:    '🔒 Disabled store',
    activate_store:   '✅ Activated store',
    delete_store:     '🗑 Deleted store',
    set_plan:         '📦 Set plan',
    extend_trial:     '⏰ Extended trial',
    save_notes:       '📝 Saved notes',
    set_drip_paused:  '💧 Toggled drip emails',
    send_email:       '📧 Sent email',
    broadcast:        '📢 Broadcast',
    run_drip:         '💧 Ran drip',
    ticket_status:    '🎫 Updated ticket',
    ticket_reply:     '💬 Replied to ticket',
    ticket_delete:    '🗑 Deleted ticket',
    db_cleanup:       '🧹 DB cleanup',
    admin_profile:    '👤 Updated profile',
    admin_password:   '🔑 Changed password',
    platform_config:  '⚙ Updated platform config',
    remind_store:     '📧 Sent reminder',
  }
  return map[action] || action
}

export default function AdminActivity() {
  const { token } = useAdminAuth()
  const { toasts, toast } = useToast()
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await api('/api/admin/activity-log', { token })
      setLog(res.entries || [])
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">Activity Log</h2>
          <p className="ad-page-desc">Recent admin actions, recorded server-side.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="ad-notice info" style={{ marginBottom: '1.25rem' }}>
        <Info size={14} style={{ flex: 'none' }} />
        <span>Every admin action below is written by the server at the moment it happens — this log persists independently of your browser and cannot be cleared from here.</span>
      </div>

      <div className="sd-card">
        <div className="sd-card-title"><Activity size={17} /> Recent Actions</div>
        {!loading && log.length === 0 ? (
          <div className="sd-empty">
            <div className="sd-empty-icon"><Activity size={24} /></div>
            <p>No activity logged yet. Actions you take will appear here.</p>
          </div>
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr><th>When</th><th>Admin</th><th>Action</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {log.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span title={entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}>
                        {relTime(entry.createdAt)}
                      </span>
                    </td>
                    <td className="muted tiny">{entry.adminEmail || '—'}</td>
                    <td><strong>{actionLabel(entry.action)}</strong></td>
                    <td>
                      <code style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                        {entry.detail || '—'}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
