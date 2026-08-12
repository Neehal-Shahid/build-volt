import { useEffect, useState } from 'react'
import { BarChart3, Users, Star } from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useToast } from './useToast'
import { ToastArea } from './adminUi'

function PlanBar({ plan, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const colors = { trial: '#f59e0b', starter: '#3b82f6', growth: '#8b5cf6', pro: '#10b981' }
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ fontWeight: 700, textTransform: 'capitalize', color: 'var(--navy)' }}>{plan}</span>
        <span style={{ fontWeight: 700, color: 'var(--muted)' }}>{count} &nbsp;<small>({pct}%)</small></span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--gray-light)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999,
          background: colors[plan] || 'var(--blue)', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

export default function AdminPlatformStats() {
  const { token } = useAdminAuth()
  const { toasts, toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const r = await api('/api/admin/platform-stats', { token })
        setData(r)
      } catch (err) {
        toast(err.message, 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const total = (data?.trial ?? 0) + (data?.paid ?? 0)
  const dist = data?.planDistribution || []
  const top = data?.topStores || []

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">Platform Stats</h2>
          <p className="ad-page-desc">Plan distribution, trial vs paid conversion, and top stores by usage.</p>
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
              <span className="sd-stat-icon amber"><Users size={20} strokeWidth={1.75} /></span>
              <div className="sd-stat-body">
                <span className="sd-stat-label">Trial Stores</span>
                <div className="sd-stat-value">{data?.trial ?? 0}</div>
              </div>
            </div>
            <div className="sd-stat-card">
              <span className="sd-stat-icon green"><Users size={20} strokeWidth={1.75} /></span>
              <div className="sd-stat-body">
                <span className="sd-stat-label">Paid Stores</span>
                <div className="sd-stat-value">{data?.paid ?? 0}</div>
              </div>
            </div>
            <div className="sd-stat-card">
              <span className="sd-stat-icon blue"><BarChart3 size={20} strokeWidth={1.75} /></span>
              <div className="sd-stat-body">
                <span className="sd-stat-label">Total Stores</span>
                <div className="sd-stat-value">{total}</div>
              </div>
            </div>
            <div className="sd-stat-card">
              <span className="sd-stat-icon purple"><Star size={20} strokeWidth={1.75} /></span>
              <div className="sd-stat-body">
                <span className="sd-stat-label">Conversion Rate</span>
                <div className="sd-stat-value">
                  {total > 0 ? `${Math.round(((data?.paid ?? 0) / total) * 100)}%` : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
            <div className="sd-card-title"><BarChart3 size={17} /> Plan Distribution</div>
            {dist.length === 0
              ? <p className="muted">No plan data yet.</p>
              : dist.map((d) => (
                <PlanBar key={d.plan} plan={d.plan} count={d.count} total={total} />
              ))}
          </div>

          <div className="sd-card">
            <div className="sd-card-title"><Star size={17} /> Top Stores by Recommendations</div>
            {top.length === 0 ? (
              <div className="sd-empty">
                <div className="sd-empty-icon"><Star size={24} /></div>
                <p>No recommendation data yet.</p>
              </div>
            ) : (
              <div className="sd-table-wrap">
                <table className="sd-table">
                  <thead>
                    <tr><th>#</th><th>Store</th><th>Plan</th><th>Recommendations</th></tr>
                  </thead>
                  <tbody>
                    {top.map((s, i) => (
                      <tr key={s.id}>
                        <td><span style={{ fontWeight: 800, color: 'var(--muted)' }}>#{i + 1}</span></td>
                        <td>
                          <strong>{s.name || s.id}</strong>
                          <div className="muted tiny">{s.email}</div>
                        </td>
                        <td><span className="sd-badge blue">{s.plan}</span></td>
                        <td><strong>{s.recommendations}</strong></td>
                      </tr>
                    ))}
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
