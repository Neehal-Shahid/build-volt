import { useEffect, useState } from 'react'
import { Store, Search, X, CheckCircle, XCircle, Trash2, UserCheck, UserX } from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'

export default function AdminStores() {
  const { token } = useAdminAuth()
  const [q, setQ] = useState('')
  const [stores, setStores] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [manage, setManage] = useState(null)
  const [notes, setNotes] = useState('')
  const [plan, setPlan] = useState('trial')

  async function load(search = q) {
    setError('')
    try {
      const res = await api(
        `/api/admin/stores${search ? `?q=${encodeURIComponent(search)}` : ''}`,
        { token }
      )
      setStores(res.stores || [])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function act(path, body) {
    setError('')
    setMessage('')
    try {
      const res = await api(path, { method: 'POST', token, body })
      setMessage(res.message || 'Updated')
      if (res.store && manage?.id === res.store.id) {
        setManage(res.store)
        setNotes(res.store.adminNotes || '')
        setPlan(res.store.plan || 'trial')
      }
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function openManage(s) {
    setManage(s)
    setNotes(s.adminNotes || '')
    setPlan(s.plan || 'trial')
  }

  return (
    <div>
      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">All Stores</h2>
          <p className="ad-page-desc">Search, activate, disable, delete, or manage plans.</p>
        </div>
      </div>

      {message && (
        <div className="sd-alert sd-alert-success" style={{ marginBottom: '1rem' }}>
          <CheckCircle size={16} />
          {message}
        </div>
      )}
      {error && (
        <div className="sd-alert sd-alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Search toolbar */}
      <div className="sd-toolbar" style={{ marginBottom: '1.25rem' }}>
        <div className="sd-toolbar-search">
          <Search size={15} />
          <input
            placeholder="Search by id, email, name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => load()}>
          Search
        </button>
      </div>

      <div className="sd-card">
        <div className="sd-card-title">
          <Store size={17} />
          Stores ({stores.length})
        </div>
        {stores.length === 0 ? (
          <div className="sd-empty">
            <div className="sd-empty-icon">
              <Store size={24} />
            </div>
            <p>No stores found matching your search.</p>
          </div>
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name || '—'}</strong>
                      <div className="muted tiny">
                        <code>{s.id}</code>
                      </div>
                      <div className="muted tiny">{s.email}</div>
                    </td>
                    <td><span className="sd-badge blue">{s.plan}</span></td>
                    <td>
                      <span className={`sd-badge ${s.disabled ? 'red' : 'green'}`}>
                        {s.disabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <div className="sd-row-actions">
                        <button
                          type="button"
                          className="sd-icon-btn"
                          title="Manage"
                          onClick={() => openManage(s)}
                        >
                          <Store size={14} />
                        </button>
                        {s.disabled ? (
                          <button
                            type="button"
                            className="sd-icon-btn"
                            title="Activate"
                            onClick={() => act('/api/admin/activate-store', { storeId: s.id })}
                            style={{ color: '#059669', borderColor: '#a7f3d0' }}
                          >
                            <UserCheck size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="sd-icon-btn danger"
                            title="Disable"
                            onClick={() => act('/api/admin/disable-store', { storeId: s.id })}
                          >
                            <UserX size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="sd-icon-btn danger"
                          title="Delete"
                          onClick={() => {
                            if (window.confirm(`Delete store ${s.id}?`)) {
                              act('/api/admin/delete-store', { storeId: s.id })
                            }
                          }}
                        >
                          <Trash2 size={14} />
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

      {/* Manage modal */}
      {manage && (
        <div className="modal-backdrop" onClick={() => setManage(null)}>
          <form
            className="card-form modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              act('/api/admin/set-plan', { storeId: manage.id, plan })
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <h3 style={{ margin: 0 }}>Manage {manage.name || manage.id}</h3>
              <button
                type="button"
                onClick={() => setManage(null)}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>
            <p className="muted tiny">
              <code>{manage.id}</code> · {manage.email}
            </p>
            <label>
              Plan override
              <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="trial">trial</option>
                <option value="starter">starter</option>
                <option value="growth">growth</option>
                <option value="pro">pro</option>
              </select>
            </label>
            <div className="actions">
              <button className="btn" type="submit">
                Save plan
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => act('/api/admin/extend-trial', { storeId: manage.id, days: 7 })}
              >
                Extend trial +7d
              </button>
            </div>
            <label>
              Admin notes
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => act('/api/admin/save-notes', { storeId: manage.id, notes })}
            >
              Save notes
            </button>
            <label className="check-row">
              <input
                type="checkbox"
                checked={!!manage.dripEmailsPaused}
                onChange={(e) =>
                  act('/api/admin/set-drip-paused', {
                    storeId: manage.id,
                    paused: e.target.checked,
                  })
                }
              />
              Pause drip emails
            </label>
          </form>
        </div>
      )}
    </div>
  )
}
