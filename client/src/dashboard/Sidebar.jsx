import { useEffect, useState } from 'react'
import { X, LogOut, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from '../landing/Logo'
import { getWidgetStatus } from '../lib/widgetStatus'

const STATUS_DOT = {
  active: '#34d399',
  disabled: '#f87171',
  not_installed: '#fbbf24',
  paused: '#f87171',
}

const STATUS_TITLE = {
  active: 'Widget active on your site',
  disabled: 'Widget installed but disabled',
  not_installed: 'Widget not yet installed',
  paused: 'Widget paused — upgrade or renew plan',
}

export default function Sidebar({ groups, tab, onSelect, store, onLogout, open, onClose }) {
  const isTrial = store?.plan === 'trial'
  const [widgetStatus, setWidgetStatus] = useState(() => getWidgetStatus(store))

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

  const planEnds = store?.planEnds || store?.trialEnds
  const daysLeft = planEnds
    ? Math.max(0, Math.ceil((new Date(planEnds) - Date.now()) / 86400000))
    : null

  return (
    <>
      <div
        className={`sd-sidebar-backdrop ${open ? 'is-open' : ''}`}
        onClick={onClose}
        role="presentation"
      />
      <aside className={`sd-sidebar ${open ? 'is-open' : ''}`}>
        <div className="sd-sidebar-brand">
          <Link to="/">
            <Logo />
          </Link>
          <button
            type="button"
            className="sd-sidebar-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <div className="sd-sidebar-store">
          <div className="sd-sidebar-store-row">
            <span className="sd-sidebar-store-name">{store?.name || 'Your store'}</span>
            <span
              className="sd-sidebar-live-dot"
              title={STATUS_TITLE[widgetStatus]}
              style={{ background: STATUS_DOT[widgetStatus] }}
            />
          </div>
          <div className="sd-sidebar-store-meta">
            <span className={`sd-plan-pill ${isTrial ? 'trial' : 'paid'}`}>
              {isTrial ? 'Trial' : store?.plan || 'Trial'}
            </span>
            {daysLeft !== null && (
              <span className="sd-sidebar-days">
                {daysLeft}d left
              </span>
            )}
          </div>
        </div>

        <nav className="sd-nav" aria-label="Dashboard navigation">
          {groups.map((group) => (
            <div key={group.label}>
              <span className="sd-nav-group-label">{group.label}</span>
              {group.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`sd-nav-item${tab === t.id ? ' active' : ''}`}
                  onClick={() => onSelect(t.id)}
                >
                  <t.icon size={17} strokeWidth={2} />
                  {t.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sd-sidebar-footer">
          {isTrial && (
            <div className="sd-upgrade-card">
              <p>
                <Sparkles size={13} strokeWidth={2.5} style={{ marginRight: 4, verticalAlign: -2 }} />
                Upgrade for higher recommendation limits and priority support.
              </p>
              <button type="button" className="btn" onClick={() => onSelect('billing')}>
                View plans
              </button>
            </div>
          )}
          <button
            type="button"
            className="btn btn-ghost sd-logout-btn"
            onClick={onLogout}
          >
            <LogOut size={16} strokeWidth={2.25} />
            Log out
          </button>
        </div>
      </aside>
    </>
  )
}
