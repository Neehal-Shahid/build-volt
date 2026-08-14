import { useEffect, useState } from 'react'
import {
  Store, Search, X, CheckCircle, XCircle, Trash2,
  UserCheck, UserX, Package, Wifi, WifiOff, AlertCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useToast } from './useToast'
import { ToastArea, relTime } from './adminUi'

export default function AdminStores() {
  const { token } = useAdminAuth()
  const { toasts, toast } = useToast()

  const [q, setQ]                     = useState('')
  const [stores, setStores]           = useState([])
  const [manage, setManage]           = useState(null)
  const [notes, setNotes]             = useState('')
  const [plan, setPlan]               = useState('trial')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [storeProducts, setStoreProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // ─── data loading ────────────────────────────────────────────────────────────

  async function load(search = q) {
    try {
      const res = await api(
        `/api/admin/stores${search ? `?q=${encodeURIComponent(search)}` : ''}`,
        { token },
      )
      setStores(res.stores || [])
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function loadProducts(storeId) {
    setLoadingProducts(true)
    setStoreProducts([])
    try {
      const res = await api(`/api/admin/store-products/${storeId}`, { token })
      setStoreProducts(res.products || [])
    } catch (err) {
      toast(`Products: ${err.message}`, 'error')
    } finally {
      setLoadingProducts(false)
    }
  }

  // ─── actions ─────────────────────────────────────────────────────────────────

  async function act(path, body) {
    try {
      const res = await api(path, { method: 'POST', token, body })
      toast(res.message || 'Updated', 'success')
      if (res.store && manage?.id === res.store.id) {
        setManage(res.store)
        setNotes(res.store.adminNotes || '')
        setPlan(res.store.plan || 'trial')
      }
      await load()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    if (manage?.id === id) setManage(null)
    await act('/api/admin/delete-store', { storeId: id })
  }

  // ─── manage modal helpers ─────────────────────────────────────────────────────

  function openManage(s) {
    setManage(s)
    setNotes(s.adminNotes || '')
    setPlan(s.plan || 'trial')
    loadProducts(s.id)
  }

  function closeManage() {
    setManage(null)
    setStoreProducts([])
  }

  // ─── render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">All Stores</h2>
          <p className="ad-page-desc">Search, activate, disable, delete, or manage plans.</p>
        </div>
      </div>

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

      {/* Stores table */}
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
                  <th>Woo</th>
                  <th>Widget</th>
                  <th>Last seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id}>
                    {/* Store info */}
                    <td>
                      <strong>{s.name || '—'}</strong>
                      <div className="muted tiny">
                        <code>{s.id}</code>
                      </div>
                      <div className="muted tiny">{s.email}</div>
                    </td>

                    {/* Plan */}
                    <td>
                      <span className="sd-badge blue">{s.plan}</span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`sd-badge ${s.disabled ? 'red' : 'green'}`}>
                        {s.disabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>

                    {/* WooCommerce connected */}
                    <td>
                      {s.wooConnected ? (
                        <span title="WooCommerce connected" style={{ color: '#059669', display: 'inline-flex' }}>
                          <Wifi size={16} />
                        </span>
                      ) : (
                        <span title="WooCommerce not connected" style={{ color: 'var(--muted)', display: 'inline-flex' }}>
                          <WifiOff size={16} />
                        </span>
                      )}
                    </td>

                    {/* Widget installed */}
                    <td>
                      {s.widgetInstalled ? (
                        <span className="sd-badge green">Installed</span>
                      ) : (
                        <span className="sd-badge gray">Not set up</span>
                      )}
                    </td>

                    {/* Last seen */}
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.8rem' }}>
                      {relTime(s.widgetLastSeen)}
                    </td>

                    {/* Actions */}
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
                          onClick={() => setDeleteTarget(s)}
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

      {/* ── Manage modal ──────────────────────────────────────────────────────── */}
      {manage && (
        <div className="modal-backdrop" onClick={closeManage}>
          <form
            className="card-form modal-card"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              act('/api/admin/set-plan', { storeId: manage.id, plan })
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <h3 style={{ margin: 0 }}>Manage {manage.name || manage.id}</h3>
              <button
                type="button"
                onClick={closeManage}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>
            <p className="muted tiny">
              <code>{manage.id}</code> · {manage.email}
            </p>

            {/* Plan */}
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
              <button
                className="btn btn-ghost"
                type="button"
                title="Restarts this store's trial from today using the current global trial length"
                onClick={() => act('/api/admin/reset-trial', { storeId: manage.id })}
              >
                Reset trial to current default
              </button>
            </div>

            {/* Admin notes */}
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

            {/* Drip emails */}
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

            {/* ── Products section ──────────────────────────────────────── */}
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                <Package size={15} style={{ color: 'var(--muted)' }} />
                <strong style={{ fontSize: '0.9rem' }}>
                  Products{!loadingProducts && ` (${storeProducts.length})`}
                </strong>
              </div>

              {loadingProducts ? (
                <p className="muted tiny" style={{ marginTop: 0 }}>Loading products…</p>
              ) : storeProducts.length === 0 ? (
                <p className="muted tiny" style={{ marginTop: 0 }}>No products yet.</p>
              ) : (
                <div className="sd-table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <table className="sd-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeProducts.map((p) => (
                        <tr key={p.id ?? p._id ?? p.name}>
                          <td>{p.name || '—'}</td>
                          <td style={{ color: 'var(--muted)' }}>{p.category || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {p.price != null ? `$${Number(p.price).toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── Delete confirm modal ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <div
          className="modal-backdrop"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="card-form modal-card"
            style={{ maxWidth: 380, textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#b91c1c',
              }}>
                <Trash2 size={22} />
              </span>
            </div>
            <h3 style={{ margin: '0 0 0.4rem' }}>
              Delete {deleteTarget.name || deleteTarget.id}?
            </h3>
            <p className="muted" style={{ margin: '0 0 1.25rem', fontSize: '0.88rem' }}>
              This cannot be undone. All store data will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#b91c1c', borderColor: '#b91c1c', color: '#fff' }}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
