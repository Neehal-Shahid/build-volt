import { useEffect, useState, useCallback } from 'react'
import { CreditCard, CheckCircle, XCircle, Clock, Filter } from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminActivity } from './activityLog'
import { useToast } from './useToast'
import { ToastArea, relTime } from './adminUi'

const FILTERS = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all',      label: 'All'      },
]

function methodPill(method) {
  if (!method) return null
  const lower = method.toLowerCase()
  const isDemo = lower.includes('demo') || lower.includes('card') || lower.includes('test')
  const isJazz = lower.includes('jazz') || lower.includes('easy') || lower.includes('paisa')
  return (
    <span className={`sd-badge ${isDemo ? 'purple' : isJazz ? 'blue' : 'gray'}`}
      style={{ fontSize: '0.7rem' }}>
      {isDemo ? '💳 Demo' : isJazz ? '📱 JazzCash' : method}
    </span>
  )
}

export default function AdminPayments() {
  const { token } = useAdminAuth()
  const { toasts, toast } = useToast()
  const [filter, setFilter] = useState('pending')
  const [payments, setPayments] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Load current filter + pending count for badge
      const [main, pendingRes] = await Promise.all([
        api(`/api/admin/payments?status=${encodeURIComponent(filter)}`, { token }),
        filter !== 'pending'
          ? api('/api/admin/payments?status=pending', { token })
          : null,
      ])
      setPayments(main.payments || [])
      setCounts((prev) => ({
        ...prev,
        [filter]: (main.payments || []).length,
        ...(pendingRes ? { pending: (pendingRes.payments || []).length } : {}),
      }))
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [token, filter])

  useEffect(() => { load() }, [load])

  async function approve(id) {
    setBusyId(id)
    try {
      await api('/api/admin/approve-payment', { method: 'POST', token, body: { paymentId: id } })
      logAdminActivity('approve_payment', String(id))
      toast('Payment approved — plan activated 30 days ✓', 'success')
      await load()
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyId(null) }
  }

  async function reject(id) {
    const reason = window.prompt('Rejection reason (optional):') || ''
    setBusyId(id)
    try {
      await api('/api/admin/reject-payment', { method: 'POST', token, body: { paymentId: id, reason } })
      logAdminActivity('reject_payment', String(id))
      toast('Payment rejected', 'success')
      await load()
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyId(null) }
  }

  function statusBadge(s) {
    return { pending: 'amber', approved: 'green', rejected: 'red' }[s] || 'gray'
  }

  const pendingCount = counts['pending'] ?? 0

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">Payments</h2>
          <p className="ad-page-desc">
            Approve JazzCash / EasyPaisa submissions.
            Demo card payments auto-approve immediately.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="sd-badge amber" style={{ fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}>
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Pill filter bar */}
      <div className="ad-pill-filter">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={filter === f.key ? 'active' : ''}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key !== 'all' && counts[f.key] != null && (
              <span className="ad-pill-count">{counts[f.key]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="sd-card">
        <div className="sd-card-title">
          <CreditCard size={17} />
          {FILTERS.find(f => f.key === filter)?.label} Payments
        </div>

        {loading ? (
          <div>
            {[1,2,3].map(i => <div key={i} className="sd-skel sd-skel-row" style={{ marginBottom: '0.5rem' }} />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="sd-empty">
            <div className="sd-empty-icon"><Clock size={24} /></div>
            <p>No {filter === 'all' ? '' : filter} payments found.</p>
          </div>
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Store</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span title={p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}>
                        {relTime(p.createdAt)}
                      </span>
                      {p.reviewedAt && (
                        <div className="muted tiny">
                          Reviewed {relTime(p.reviewedAt)}
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>{p.storeName || p.storeId}</strong>
                      <div className="muted tiny">{p.storeEmail}</div>
                    </td>
                    <td><span className="sd-badge blue">{p.plan}</span></td>
                    <td><strong>PKR {Number(p.amount).toLocaleString()}</strong></td>
                    <td>
                      {methodPill(p.method)}
                      {p.transactionRef && (
                        <div className="muted tiny" style={{ marginTop: '0.2rem' }}>
                          Ref: {p.transactionRef}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`sd-badge ${statusBadge(p.status)}`}>{p.status}</span>
                    </td>
                    <td>
                      {p.status === 'pending' && (
                        <div className="sd-row-actions">
                          <button type="button" className="sd-icon-btn" title="Approve"
                            disabled={busyId === p.id} onClick={() => approve(p.id)}
                            style={{ color: '#059669', borderColor: '#a7f3d0' }}>
                            <CheckCircle size={15} />
                          </button>
                          <button type="button" className="sd-icon-btn danger" title="Reject"
                            disabled={busyId === p.id} onClick={() => reject(p.id)}>
                            <XCircle size={15} />
                          </button>
                        </div>
                      )}
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
