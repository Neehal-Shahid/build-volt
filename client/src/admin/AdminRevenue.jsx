import { useEffect, useState } from 'react'
import { TrendingUp, DollarSign, AlertTriangle, Mail, CheckCircle } from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useToast } from './useToast'
import { ToastArea, relTime } from './adminUi'

export default function AdminRevenue() {
  const { token } = useAdminAuth()
  const { toasts, toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const r = await api('/api/admin/revenue', { token })
        setData(r)
      } catch (err) {
        toast(err.message, 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  async function remind(storeId) {
    setBusyId(storeId)
    try {
      await api('/api/admin/remind-store', { method: 'POST', token, body: { storeId } })
      toast('Renewal reminder sent', 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusyId(null) }
  }

  function daysLeft(iso) {
    if (!iso) return null
    const ms = new Date(iso).getTime() - Date.now()
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
  }

  const atRisk = data?.atRisk || []

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">Revenue</h2>
          <p className="ad-page-desc">MRR estimate, approved revenue, and stores at renewal risk.</p>
        </div>
      </div>

      {loading ? (
        <div>
          <div className="sd-skel sd-skel-card" />
          <div className="sd-skel sd-skel-card" style={{ marginTop: '1rem' }} />
        </div>
      ) : (
        <>
          <div className="sd-stats-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="sd-stat-card">
              <span className="sd-stat-icon green"><TrendingUp size={20} strokeWidth={1.75} /></span>
              <div className="sd-stat-body">
                <span className="sd-stat-label">MRR (PKR)</span>
                <div className="sd-stat-value">{Number(data?.mrr || 0).toLocaleString()}</div>
              </div>
            </div>
            <div className="sd-stat-card">
              <span className="sd-stat-icon blue"><DollarSign size={20} strokeWidth={1.75} /></span>
              <div className="sd-stat-body">
                <span className="sd-stat-label">Approved Total (PKR)</span>
                <div className="sd-stat-value">
                  {Number(data?.totalApprovedRevenue || 0).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="sd-stat-card">
              <span className="sd-stat-icon amber"><AlertTriangle size={20} strokeWidth={1.75} /></span>
              <div className="sd-stat-body">
                <span className="sd-stat-label">At-Risk Stores</span>
                <div className="sd-stat-value">{atRisk.length}</div>
                <span className="sd-stat-label" style={{ fontSize: '0.7rem' }}>plan ending ≤7 days</span>
              </div>
            </div>
          </div>

          {/* Monthly Revenue Chart */}
          {data?.monthlyRevenue && data.monthlyRevenue.length > 0 && (
            <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
              <div className="sd-card-title">
                <TrendingUp size={17} />
                Monthly Revenue (last 6 months)
              </div>
              <div className="bars">
                {(() => {
                  const maxVal = Math.max(1, ...data.monthlyRevenue.map(m => m.total))
                  return data.monthlyRevenue.map(m => (
                    <div className="bar-row" key={m.month}>
                      <span className="bar-label">{m.month}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(m.total / maxVal) * 100}%` }} />
                      </div>
                      <span className="bar-count">PKR {Number(m.total).toLocaleString()}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

          <div className="sd-card">
            <div className="sd-card-title">
              <AlertTriangle size={17} />
              At-Risk Stores
              <small className="muted" style={{ marginLeft: '0.5rem', fontWeight: 400 }}>plan ending within 7 days</small>
            </div>
            {atRisk.length === 0 ? (
              <div className="sd-empty">
                <div className="sd-empty-icon"><CheckCircle size={24} /></div>
                <p>No at-risk stores right now — all good!</p>
              </div>
            ) : (
              <div className="sd-table-wrap">
                <table className="sd-table">
                  <thead>
                    <tr><th>Store</th><th>Plan</th><th>Expires</th><th>Days left</th><th></th></tr>
                  </thead>
                  <tbody>
                    {atRisk.map((s) => {
                      const dl = daysLeft(s.planEnds)
                      return (
                        <tr key={s.id}>
                          <td>
                            <strong>{s.name || s.id}</strong>
                            <div className="muted tiny">{s.email}</div>
                          </td>
                          <td><span className="sd-badge blue">{s.plan}</span></td>
                          <td>
                            <span title={s.planEnds ? new Date(s.planEnds).toLocaleString() : ''}>
                              {relTime(s.planEnds?.replace('Z',''))}
                            </span>
                          </td>
                          <td>
                            <span className={`sd-badge ${dl != null && dl <= 2 ? 'red' : 'amber'}`}>
                              {dl != null ? `${dl}d` : '—'}
                            </span>
                          </td>
                          <td>
                            <button type="button" className="sd-icon-btn" title="Send renewal reminder"
                              disabled={busyId === s.id} onClick={() => remind(s.id)}>
                              <Mail size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
