import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Store, CreditCard, CheckCircle, XCircle,
  RefreshCw, Clock, UserPlus
} from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useToast } from './useToast'
import { ToastArea, relTime } from './adminUi'

export default function AdminOverview({ onGoTab }) {
  const { token } = useAdminAuth()
  const { toasts, toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api('/api/admin/overview', { token })
      setData(res)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  async function approve(id) {
    setBusyId(id)
    try {
      await api('/api/admin/approve-payment', { method: 'POST', token, body: { paymentId: id } })
      toast('Payment approved — plan activated 30 days', 'success')
      await load()
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyId(null) }
  }

  async function reject(id) {
    const reason = window.prompt('Rejection reason (optional):') || ''
    setBusyId(id)
    try {
      await api('/api/admin/reject-payment', { method: 'POST', token, body: { paymentId: id, reason } })
      toast('Payment rejected', 'success')
      await load()
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyId(null) }
  }

  if (loading && !data) {
    return (
      <div>
        <div className="sd-stats-grid" style={{ marginBottom: '1.5rem' }}>
          {[1,2,3,4].map(i => <div key={i} className="sd-skel sd-skel-stat" />)}
        </div>
        <div className="sd-skel sd-skel-card" />
        <div className="sd-skel sd-skel-card" style={{ marginTop: '1rem' }} />
      </div>
    )
  }

  const recentStores = data?.recentStores || []
  const pending      = data?.pendingPayments || []

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">Overview</h2>
          <p className="ad-page-desc">Platform snapshot — stores, pending payments, and revenue.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={load}
          style={{ gap: '0.4rem', display: 'inline-flex', alignItems: 'center' }}>
          <RefreshCw size={15} strokeWidth={2} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="sd-stats-grid">
        <div className="sd-stat-card">
          <span className="sd-stat-icon blue"><Store size={20} strokeWidth={1.75} /></span>
          <div className="sd-stat-body">
            <span className="sd-stat-label">Total Stores</span>
            <div className="sd-stat-value">{data?.stats.stores ?? 0}</div>
          </div>
        </div>
        <div className="sd-stat-card">
          <span className="sd-stat-icon purple"><LayoutDashboard size={20} strokeWidth={1.75} /></span>
          <div className="sd-stat-body">
            <span className="sd-stat-label">Recommendations</span>
            <div className="sd-stat-value">{data?.stats.recommendations ?? 0}</div>
          </div>
        </div>
        <div className="sd-stat-card">
          <span className="sd-stat-icon amber"><CreditCard size={20} strokeWidth={1.75} /></span>
          <div className="sd-stat-body">
            <span className="sd-stat-label">Pending Payments</span>
            <div className="sd-stat-value">{data?.stats.pendingPayments ?? 0}</div>
          </div>
        </div>
        <div className="sd-stat-card">
          <span className="sd-stat-icon green"><CheckCircle size={20} strokeWidth={1.75} /></span>
          <div className="sd-stat-body">
            <span className="sd-stat-label">Approved Revenue</span>
            <div className="sd-stat-value" style={{ fontSize: '1.05rem' }}>
              PKR {Number(data?.stats.revenueApproved || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Pending payments */}
      <div className="sd-card">
        <div className="sd-card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={17} />
            Pending Payments
            {pending.length > 0 && (
              <span className="sd-badge amber">{pending.length}</span>
            )}
          </span>
          <button type="button" className="linkish" onClick={() => onGoTab('payments')}>
            View all →
          </button>
        </div>
        {pending.length === 0 ? (
          <div className="sd-empty">
            <div className="sd-empty-icon"><CheckCircle size={24} /></div>
            <p>No pending payments — all clear!</p>
          </div>
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.storeName || p.storeId}</strong>
                      <div className="muted tiny">{p.storeEmail}</div>
                    </td>
                    <td><span className="sd-badge blue">{p.plan}</span></td>
                    <td><strong>PKR {Number(p.amount).toLocaleString()}</strong></td>
                    <td>
                      {p.method}
                      {p.transactionRef && <div className="muted tiny">{p.transactionRef}</div>}
                    </td>
                    <td>
                      <span title={p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}>
                        {relTime(p.createdAt)}
                      </span>
                    </td>
                    <td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent stores — last 7 days */}
      <div className="sd-card">
        <div className="sd-card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={17} />
            New Stores — Last 7 Days
            {recentStores.length > 0 && (
              <span className="sd-badge blue">{recentStores.length}</span>
            )}
          </span>
          <button type="button" className="linkish" onClick={() => onGoTab('stores')}>
            All stores →
          </button>
        </div>
        {recentStores.length === 0 ? (
          <div className="sd-empty">
            <div className="sd-empty-icon"><Store size={24} /></div>
            <p>No new signups in the last 7 days.</p>
          </div>
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentStores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name || '—'}</strong>
                      <div className="muted tiny">{s.email}</div>
                    </td>
                    <td><span className="sd-badge blue">{s.plan}</span></td>
                    <td>
                      <span className={`sd-badge ${s.disabled ? 'red' : 'green'}`}>
                        {s.disabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <span title={s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}>
                        <Clock size={12} style={{ verticalAlign: -2, marginRight: 3 }} />
                        {relTime(s.createdAt)}
                      </span>
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
