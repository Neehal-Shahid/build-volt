import { Activity, Trash2, Info } from 'lucide-react'
import { useState } from 'react'
import { getAdminActivity, clearAdminActivity } from './activityLog'
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
    send_email:       '📧 Sent email',
    broadcast:        '📢 Broadcast',
    run_drip:         '💧 Ran drip',
    ticket_status:    '🎫 Updated ticket',
    ticket_delete:    '🗑 Deleted ticket',
    db_cleanup:       '🧹 DB cleanup',
    api_model_save:   '🤖 Saved model config',
    admin_profile:    '👤 Updated profile',
    admin_password:   '🔑 Changed password',
    payment_config:   '⚙ Updated payments config',
    platform_config:  '⚙ Updated platform config',
    remind_store:     '📧 Sent reminder',
    save_notes:       '📝 Saved notes',
  }
  return map[action] || action
}

export default function AdminActivity() {
  const { toasts, toast } = useToast()
  const [log, setLog] = useState(() => getAdminActivity())

  function clear() {
    if (!window.confirm('Clear all activity log entries from this browser?')) return
    clearAdminActivity()
    setLog([])
    toast('Activity log cleared', 'success')
  }

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">Activity Log</h2>
          <p className="ad-page-desc">Recent admin actions recorded in this browser session.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={clear}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#b91c1c' }}>
          <Trash2 size={14} /> Clear log
        </button>
      </div>

      <div className="ad-notice info" style={{ marginBottom: '1.25rem' }}>
        <Info size={14} style={{ flex: 'none' }} />
        <span>Activity is stored in your browser's localStorage. It persists across page reloads but is local to this device only.</span>
      </div>

      <div className="sd-card">
        <div className="sd-card-title"><Activity size={17} /> Recent Actions</div>
        {log.length === 0 ? (
          <div className="sd-empty">
            <div className="sd-empty-icon"><Activity size={24} /></div>
            <p>No activity logged yet. Actions you take will appear here.</p>
          </div>
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr><th>When</th><th>Action</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {[...log].reverse().map((entry, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span title={entry.at ? new Date(entry.at).toLocaleString() : ''}>
                        {relTime(entry.at)}
                      </span>
                    </td>
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
