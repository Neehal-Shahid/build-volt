import { useEffect, useState } from 'react'
import {
  MessageSquare, Send, Radio, Play, CheckCircle, Ticket,
  Mail, RefreshCw, Trash2, Info, AlertTriangle, X, Clock, Reply
} from 'lucide-react'
import { api } from '../lib/api'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminActivity } from './activityLog'
import { useToast } from './useToast'
import { ToastArea, relTime } from './adminUi'

const TO_OPTIONS = [
  { id: 'single',    label: 'Single Store',             desc: 'Send to one specific store.' },
  { id: 'marketing', label: 'All Stores (opted-in)',    desc: 'Stores with marketing emails enabled.' },
  { id: 'everyone',  label: 'All Stores (everyone)',    desc: 'Send to every active store regardless of preference.' },
]

const TICKET_FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'open',    label: 'Open' },
  { key: 'pending', label: 'Pending' },
  { key: 'closed',  label: 'Closed' },
]

function ticketBadge(status) {
  return { open: 'amber', pending: 'blue', closed: 'green' }[status] || 'gray'
}

export default function AdminComms() {
  const { token } = useAdminAuth()
  const { toasts, toast } = useToast()

  const [stores, setStores] = useState([])
  const [emails, setEmails] = useState([])
  const [tickets, setTickets] = useState([])
  const [ticketFilter, setTicketFilter] = useState('all')
  const [loadingTickets, setLoadingTickets] = useState(false)

  // Compose form
  const [toMode, setToMode] = useState('single')
  const [storeId, setStoreId] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Drip result
  const [dripResult, setDripResult] = useState(null)

  // Ticket reply
  const [replyTarget, setReplyTarget] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)

  async function refresh() {
    try {
      const [s, e] = await Promise.all([
        api('/api/admin/stores', { token }),
        api('/api/admin/email-log?limit=50', { token }),
      ])
      setStores(s.stores || [])
      setEmails(e.emails || [])
      if (!storeId && s.stores?.[0]) setStoreId(s.stores[0].id)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function loadTickets(filter = ticketFilter) {
    setLoadingTickets(true)
    try {
      const t = await api(
        `/api/admin/support-tickets${filter !== 'all' ? `?status=${filter}` : ''}`,
        { token }
      )
      setTickets(t.tickets || [])
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoadingTickets(false)
    }
  }

  useEffect(() => {
    refresh()
    loadTickets()
  }, [token])

  useEffect(() => {
    loadTickets(ticketFilter)
  }, [ticketFilter])

  async function send(e) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      toast('Subject and message are required', 'error')
      return
    }

    if (toMode !== 'single') {
      const everyone = toMode === 'everyone'
      const label = everyone ? 'ALL stores (ignoring marketing prefs)' : 'all opted-in stores'
      if (!window.confirm(`Send broadcast to ${label}?\n\nSubject: ${subject}`)) return
    }

    setBusy(true)
    try {
      if (toMode === 'single') {
        if (!storeId) { toast('Select a store', 'error'); setBusy(false); return }
        const res = await api('/api/admin/send-email', {
          method: 'POST', token,
          body: { storeId, subject, message },
        })
        logAdminActivity('send_email', storeId)
        toast(res.message || 'Email sent', 'success')
      } else {
        const res = await api('/api/admin/broadcast', {
          method: 'POST', token,
          body: { subject, message, onlyMarketing: toMode !== 'everyone' },
        })
        logAdminActivity('broadcast', `sent=${res.sent}`)
        toast(res.message || `Broadcast sent to ${res.sent} stores`, 'success')
      }
      setSubject('')
      setMessage('')
      await refresh()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function runDrip() {
    setBusy(true)
    try {
      const res = await api('/api/admin/run-drip', { method: 'POST', token })
      setDripResult(res.result)
      logAdminActivity('run_drip', `sent=${res.result?.sent}`)
      toast(`Drip done — sent ${res.result?.sent ?? 0}, skipped ${res.result?.skipped ?? 0}`, 'success')
    } catch (err) { toast(err.message, 'error') }
    finally { setBusy(false) }
  }

  async function sendReply() {
    if (!replyText.trim()) return
    setReplyBusy(true)
    try {
      await api(`/api/admin/support-tickets/${replyTarget}/reply`, {
        method: 'POST', token, body: { reply: replyText }
      })
      logAdminActivity('ticket_reply', String(replyTarget))
      toast('Reply sent', 'success')
      setReplyTarget(null)
      setReplyText('')
      await loadTickets()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setReplyBusy(false)
    }
  }

  async function setTicketStatus(id, status) {
    try {
      await api(`/api/admin/support-tickets/${id}/status`, {
        method: 'POST', token, body: { status },
      })
      logAdminActivity('ticket_status', `${id}:${status}`)
      toast(`Ticket marked ${status}`, 'success')
      await loadTickets()
    } catch (err) { toast(err.message, 'error') }
  }

  async function deleteTicket(id) {
    if (!window.confirm('Permanently delete this ticket? This cannot be undone.')) return
    try {
      await api(`/api/admin/support-tickets/${id}`, { method: 'DELETE', token })
      logAdminActivity('ticket_delete', String(id))
      toast('Ticket deleted', 'success')
      await loadTickets()
    } catch (err) { toast(err.message, 'error') }
  }

  return (
    <div>
      <ToastArea toasts={toasts} />

      <div className="ad-page-header">
        <div>
          <h2 className="ad-page-title">Communications</h2>
          <p className="ad-page-desc">Email stores, run drip campaigns, manage support tickets, and review the send log.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => { refresh(); loadTickets() }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* ── Compose form ── */}
      <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
        <div className="sd-card-title"><Send size={17} /> Compose Email</div>

        <form className="sd-form" onSubmit={send}>
          {/* To selector */}
          <div>
            <label className="sd-field-label" style={{ marginBottom: '0.5rem', display: 'block' }}>To</label>
            <div className="ad-to-select">
              {TO_OPTIONS.map((opt) => (
                <button key={opt.id} type="button"
                  className={`ad-to-option ${toMode === opt.id ? 'selected' : ''}`}
                  onClick={() => setToMode(opt.id)}>
                  <input type="radio" readOnly checked={toMode === opt.id} tabIndex={-1} />
                  <div>
                    <div className="ad-to-option-label">{opt.label}</div>
                    <div className="ad-to-option-desc">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {toMode === 'single' && (
            <div className="sd-field">
              <label className="sd-field-label">Store</label>
              <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.id} — {s.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {toMode === 'everyone' && (
            <div className="ad-notice danger">
              <AlertTriangle size={14} style={{ flex: 'none' }} />
              <span>This will email <strong>every active store</strong>, ignoring marketing opt-out. Use only for critical platform announcements.</span>
            </div>
          )}

          <div className="sd-field">
            <label className="sd-field-label">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="sd-field">
            <label className="sd-field-label">Message</label>
            <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button className="btn" type="submit" disabled={busy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              {toMode === 'single'
                ? <><Send size={14} /> Send to store</>
                : <><Radio size={14} /> Broadcast</>}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={runDrip}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Play size={14} /> Run drip now
            </button>
          </div>
        </form>

        {dripResult && (
          <div className="ad-notice info" style={{ marginTop: '1rem' }}>
            <Info size={14} style={{ flex: 'none' }} />
            <span>
              Drip complete — sent: <strong>{dripResult.sent ?? 0}</strong>,
              skipped: <strong>{dripResult.skipped ?? 0}</strong>,
              errors: <strong>{dripResult.errors ?? 0}</strong>
            </span>
          </div>
        )}
      </div>

      {/* ── Support Tickets ── */}
      <div className="sd-card" style={{ marginBottom: '1.25rem' }}>
        <div className="sd-card-title"><Ticket size={17} /> Support Tickets</div>

        {/* Ticket pill filter */}
        <div className="ad-pill-filter">
          {TICKET_FILTERS.map((f) => (
            <button key={f.key} type="button"
              className={ticketFilter === f.key ? 'active' : ''}
              onClick={() => setTicketFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="ad-notice info">
          <Info size={14} style={{ flex: 'none' }} />
          <span>Closed tickets are automatically deleted after 7 days. Use "Clean all" in DB Health to run this now.</span>
        </div>

        {loadingTickets ? (
          <div>{[1,2].map(i => <div key={i} className="sd-skel sd-skel-row" style={{ marginBottom: '0.5rem' }} />)}</div>
        ) : tickets.length === 0 ? (
          <div className="sd-empty">
            <div className="sd-empty-icon"><Ticket size={24} /></div>
            <p>No {ticketFilter === 'all' ? '' : ticketFilter} tickets.</p>
          </div>
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className={t.status === 'closed' ? 'ad-muted-row' : ''}>
                    <td>
                      <code style={{ fontSize: '0.78rem' }}>{t.storeId}</code>
                      <div className="muted tiny">{t.email}</div>
                    </td>
                    <td>
                      <strong>{t.subject}</strong>
                      {t.message && (
                        <div className="muted tiny">{t.message.slice(0, 70)}{t.message.length > 70 ? '…' : ''}</div>
                      )}
                      {t.status === 'closed' && (
                        <div className="ad-ticket-expire-note">
                          Auto-removed 7 days after closing
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`sd-badge ${ticketBadge(t.status)}`}>{t.status}</span>
                    </td>
                    <td>
                      <span title={t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}>
                        {relTime(t.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div className="sd-row-actions">
                        <button type="button" className="sd-icon-btn" title="Reply by email"
                          onClick={() => { setReplyTarget(t.id); setReplyText('') }}>
                          <Reply size={13} />
                        </button>
                        {t.status !== 'open' && (
                          <button type="button" className="sd-icon-btn" title="Reopen"
                            onClick={() => setTicketStatus(t.id, 'open')}>
                            <RefreshCw size={13} />
                          </button>
                        )}
                        {t.status !== 'pending' && (
                          <button type="button" className="sd-icon-btn" title="Mark pending"
                            onClick={() => setTicketStatus(t.id, 'pending')}>
                            <Clock size={13} />
                          </button>
                        )}
                        {t.status !== 'closed' && (
                          <button type="button" className="sd-icon-btn"
                            title="Close ticket"
                            onClick={() => setTicketStatus(t.id, 'closed')}
                            style={{ color: '#059669', borderColor: '#a7f3d0' }}>
                            <CheckCircle size={13} />
                          </button>
                        )}
                        {t.status === 'closed' && (
                          <button type="button" className="sd-icon-btn danger" title="Delete permanently"
                            onClick={() => deleteTicket(t.id)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Email Send Log ── */}
      <div className="sd-card">
        <div className="sd-card-title"><Mail size={17} /> Email Send Log</div>

        <div className="ad-notice info">
          <Clock size={14} style={{ flex: 'none' }} />
          <span>Log entries older than <strong>10 days</strong> are automatically removed. Use "Clean all" in DB Health to purge them now.</span>
        </div>

        {emails.length === 0 ? (
          <div className="sd-empty">
            <div className="sd-empty-icon"><Mail size={24} /></div>
            <p>No emails logged yet.</p>
          </div>
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Template</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => {
                  const ageMs = e.createdAt ? Date.now() - new Date(e.createdAt).getTime() : 0
                  const nearExpiry = ageMs > 7 * 24 * 60 * 60 * 1000 // >7 days
                  return (
                    <tr key={e.id} className={nearExpiry ? 'ad-muted-row' : ''}>
                      <td>
                        <span title={e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}>
                          {relTime(e.createdAt)}
                        </span>
                        {nearExpiry && (
                          <div className="ad-ticket-expire-note">Expiring soon</div>
                        )}
                      </td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.to}
                      </td>
                      <td>{e.subject}</td>
                      <td><span className="sd-badge blue" style={{ fontSize: '0.7rem' }}>{e.template}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {replyTarget !== null && (
        <div className="modal-backdrop" onClick={() => setReplyTarget(null)}>
          <div className="card-form modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Reply to ticket #{replyTarget}</h3>
              <button type="button" onClick={() => setReplyTarget(null)}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <label className="sd-field">
              <span className="sd-field-label">Your reply</span>
              <textarea rows={5} value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply to the store owner..." style={{ width: '100%', boxSizing: 'border-box' }} />
            </label>
            <div className="actions" style={{ marginTop: '0.75rem' }}>
              <button className="btn" type="button" disabled={replyBusy || !replyText.trim()} onClick={sendReply}>
                {replyBusy ? 'Sending…' : 'Send reply'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setReplyTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
