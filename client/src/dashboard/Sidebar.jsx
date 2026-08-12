import { X, LogOut, Sparkles, Wifi, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from '../landing/Logo'

export default function Sidebar({ groups, tab, onSelect, store, onLogout, open, onClose }) {
  const isTrial = store?.plan === 'trial'
  const widgetOn = store?.widgetEnabled !== false

  // Days left on plan
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
        {/* Brand */}
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

        {/* Store info card */}
        <div className="sd-sidebar-store">
          <div className="sd-sidebar-store-row">
            <span className="sd-sidebar-store-name">{store?.name || 'Your store'}</span>
            <span
              className="sd-sidebar-live-dot"
              title={widgetOn ? 'Widget live' : 'Widget disabled'}
              style={{ background: widgetOn ? '#34d399' : '#f87171' }}
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

        {/* Grouped navigation */}
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

        {/* Footer */}
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
