import { useEffect, useRef, useState } from 'react'
import { Menu, Clock, ChevronDown, UserCircle, LifeBuoy, LogOut, CreditCard, Zap, ZapOff, PauseCircle } from 'lucide-react'
import { getWidgetStatus, WIDGET_STATUS_LABELS } from '../lib/widgetStatus'

export default function Topbar({ title, store, onOpenMenu, onGoAccount, onGoHelp, onGoBilling, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [widgetStatus, setWidgetStatus] = useState(() => getWidgetStatus(store))
  const ref = useRef(null)

  useEffect(() => {
    setWidgetStatus(getWidgetStatus(store))
  }, [store])

  useEffect(() => {
    function sync() {
      setWidgetStatus(getWidgetStatus(store))
    }
    window.addEventListener('storage', sync)
    window.addEventListener('bb-widget-live-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('bb-widget-live-change', sync)
    }
  }, [store])

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const initial = (store?.name || store?.email || 'S').trim().charAt(0).toUpperCase()
  const isTrial = store?.plan === 'trial'
  const trialDays = store?.trialEnds
    ? Math.max(0, Math.ceil((new Date(store.trialEnds) - Date.now()) / 86400000))
    : null

  const statusClass =
    widgetStatus === 'active'
      ? 'live'
      : widgetStatus === 'disabled'
        ? 'offline'
        : widgetStatus === 'paused'
          ? 'paused'
          : 'pending'

  return (
    <header className="sd-topbar">
      <button type="button" className="sd-topbar-menu-btn" onClick={onOpenMenu} aria-label="Open menu">
        <Menu size={18} />
      </button>

      <h1 className="sd-topbar-title">{title}</h1>

      <div className="sd-topbar-right">
        <span className={`sd-topbar-widget-status ${statusClass}`}>
          {widgetStatus === 'active' ? (
            <><Zap size={12} strokeWidth={2.5} /> {WIDGET_STATUS_LABELS.active}</>
          ) : widgetStatus === 'disabled' ? (
            <><ZapOff size={12} strokeWidth={2.5} /> {WIDGET_STATUS_LABELS.disabled}</>
          ) : widgetStatus === 'paused' ? (
            <><PauseCircle size={12} strokeWidth={2.5} /> {WIDGET_STATUS_LABELS.paused}</>
          ) : (
            <><ZapOff size={12} strokeWidth={2.5} /> {WIDGET_STATUS_LABELS.not_installed}</>
          )}
        </span>

        {isTrial && trialDays !== null && (
          <button
            type="button"
            className="sd-topbar-trial"
            onClick={onGoBilling}
            style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
          >
            <Clock size={13} strokeWidth={2.5} />
            {trialDays > 0 ? `${trialDays}d trial left` : 'Trial ended'}
          </button>
        )}

        <div className="sd-user-menu" ref={ref}>
          <button type="button" className="sd-user-chip" onClick={() => setMenuOpen((v) => !v)}>
            <span className="sd-avatar">{initial}</span>
            <span className="sd-user-chip-name">{store?.name || store?.email}</span>
            <ChevronDown size={14} />
          </button>

          {menuOpen && (
            <div className="sd-user-dropdown">
              <button type="button" onClick={() => { setMenuOpen(false); onGoAccount(); }}>
                <UserCircle size={16} /> Account
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onGoBilling?.(); }}>
                <CreditCard size={16} /> Billing
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onGoHelp(); }}>
                <LifeBuoy size={16} /> Help
              </button>
              <button type="button" className="danger" onClick={onLogout}>
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
