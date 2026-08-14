import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  ShieldCheck,
  LayoutDashboard,
  Store,
  CreditCard,
  BarChart3,
  Settings,
  Bot,
  Database,
  TrendingUp,
  Activity,
  MessageSquare,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ShieldAlert,
} from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { api } from "../lib/api";
import AuthLayout from "../auth/AuthLayout";
import TextField from "../auth/TextField";
import PasswordField from "../auth/PasswordField";
import SubmitButton from "../auth/SubmitButton";
import Alert from "../auth/Alert";
import AdminOverview from "../admin/AdminOverview";
import AdminStores from "../admin/AdminStores";
import AdminPayments from "../admin/AdminPayments";
import AdminSettings from "../admin/AdminSettings";
import AdminPlatformStats from "../admin/AdminPlatformStats";
import AdminApiModel from "../admin/AdminApiModel";
import AdminDbHealth from "../admin/AdminDbHealth";
import AdminRevenue from "../admin/AdminRevenue";
import AdminActivity from "../admin/AdminActivity";
import AdminComms from "../admin/AdminComms";
import Logo from "../landing/Logo";
import "../admin/admin.css";
import "../dashboard/dashboard.css";

const ADMIN_PANEL = {
  eyebrow: "Admin access",
  heading: "Platform control center",
  body: "Manage stores, approve payments, and monitor usage across every BuildBot store.",
  points: [
    "Real-time platform statistics",
    "One-click payment approvals",
    "Full visibility into every store",
  ],
};

const NAV_GROUPS = [
  {
    label: "Management",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "stores", label: "All Stores", icon: Store },
      { id: "payments", label: "Payments", icon: CreditCard },
      { id: "comms", label: "Communications", icon: MessageSquare },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "stats", label: "Platform Stats", icon: BarChart3 },
      { id: "revenue", label: "Revenue", icon: TrendingUp },
    ],
  },
  {
    label: "System",
    items: [
      { id: "api", label: "API & Model", icon: Bot },
      { id: "db", label: "DB Health", icon: Database },
      { id: "activity", label: "Activity Log", icon: Activity },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

// Flat tab list for rendering content
const ALL_TABS = NAV_GROUPS.flatMap((g) => g.items);

export default function Admin() {
  const { isAdmin, booting, admin, login, logout, token } = useAdminAuth();
  const [email, setEmail] = useState("admin@buildbot.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");

  // Forgot password flow
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState('request'); // 'request' | 'reset' | 'done'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPw, setForgotNewPw] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotDevHint, setForgotDevHint] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Close user dropdown on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Close mobile sidebar when tab changes
  useEffect(() => {
    setMenuOpen(false);
  }, [tab]);

  const [pendingCount, setPendingCount] = useState(0);

  // Re-fetch pending payment count on mount and after every tab switch
  useEffect(() => {
    if (!isAdmin) return;
    api('/api/admin/payments?status=pending', { token })
      .then(r => setPendingCount((r.payments || []).length))
      .catch(() => {});
  }, [isAdmin, tab]);

  async function onLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <div className="auth-standalone">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  async function onForgotRequest(e) {
    e.preventDefault();
    setForgotBusy(true);
    setForgotError('');
    setForgotDevHint('');
    try {
      const r = await api('/api/admin/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail },
      });
      if (r.devHint) setForgotDevHint(r.devHint);
      setForgotStep('reset');
    } catch (err) {
      setForgotError(err.message || 'Request failed');
    } finally {
      setForgotBusy(false);
    }
  }

  async function onForgotReset(e) {
    e.preventDefault();
    setForgotBusy(true);
    setForgotError('');
    try {
      await api('/api/admin/reset-password', {
        method: 'POST',
        body: { email: forgotEmail, otp: forgotOtp, newPassword: forgotNewPw },
      });
      setForgotStep('done');
      setForgotMessage('Password updated successfully. You can now log in.');
    } catch (err) {
      setForgotError(err.message || 'Reset failed');
    } finally {
      setForgotBusy(false);
    }
  }

  function resetForgotFlow() {
    setShowForgot(false);
    setForgotStep('request');
    setForgotEmail('');
    setForgotOtp('');
    setForgotNewPw('');
    setForgotError('');
    setForgotMessage('');
    setForgotDevHint('');
  }

  if (!isAdmin) {
    return (
      <AuthLayout
        eyebrow="Admin"
        title="Admin login"
        subtitle="Admins table — not a store account."
        panel={ADMIN_PANEL}
        footer={
          <div className="auth-footer-links">
            <Link to="/">Home</Link>
            <span className="auth-footer-dot" />
            <Link to="/login">Store login</Link>
          </div>
        }
      >
        {showForgot ? (
          <div className="auth-form">
            <button
              type="button"
              className="btn btn-ghost auth-secondary"
              onClick={resetForgotFlow}
              style={{ alignSelf: 'flex-start', marginBottom: '0.75rem', padding: '0.25rem 0' }}
            >
              ← Back to login
            </button>

            {forgotStep === 'request' && (
              <form onSubmit={onForgotRequest} style={{ display: 'contents' }}>
                <Alert type="error">{forgotError}</Alert>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>Reset admin password</h3>
                <TextField
                  label="Admin email"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={setForgotEmail}
                  required
                />
                <SubmitButton busy={forgotBusy} busyLabel="Sending…">
                  Send reset code
                </SubmitButton>
                {forgotDevHint && (
                  <div className="auth-dev-hint" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                    <strong>Dev hint:</strong> {forgotDevHint}
                  </div>
                )}
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={onForgotReset} style={{ display: 'contents' }}>
                <Alert type="error">{forgotError}</Alert>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>Enter reset code</h3>
                {forgotDevHint && (
                  <div className="auth-dev-hint" style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                    <strong>Dev hint:</strong> {forgotDevHint}
                  </div>
                )}
                <TextField
                  label="Reset code (OTP)"
                  icon={Mail}
                  type="text"
                  autoComplete="one-time-code"
                  value={forgotOtp}
                  onChange={setForgotOtp}
                  required
                />
                <PasswordField
                  label="New password"
                  autoComplete="new-password"
                  value={forgotNewPw}
                  onChange={setForgotNewPw}
                  required
                />
                <SubmitButton busy={forgotBusy} busyLabel="Updating…">
                  <ShieldCheck size={17} strokeWidth={2.25} />
                  Update password
                </SubmitButton>
              </form>
            )}

            {forgotStep === 'done' && (
              <div>
                <Alert type="success">{forgotMessage}</Alert>
                <button
                  type="button"
                  className="btn"
                  onClick={resetForgotFlow}
                  style={{ marginTop: '0.5rem' }}
                >
                  Back to login
                </button>
              </div>
            )}
          </div>
        ) : (
          <form className="auth-form" onSubmit={onLogin}>
            <Alert type="error">{error}</Alert>

            <TextField
              label="Email"
              icon={Mail}
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              required
            />

            <PasswordField
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              required
            />

            <SubmitButton busy={busy} busyLabel="Signing in…">
              <ShieldCheck size={17} strokeWidth={2.25} />
              Log in
            </SubmitButton>

            <button
              type="button"
              className="btn btn-ghost auth-secondary"
              onClick={() => { setShowForgot(true); setForgotEmail(email); setError(''); }}
              style={{ marginTop: '0.25rem' }}
            >
              Forgot password?
            </button>
          </form>
        )}
      </AuthLayout>
    );
  }

  const activeTab = ALL_TABS.find((t) => t.id === tab) || ALL_TABS[0];
  const initial = (admin?.email || "A").trim().charAt(0).toUpperCase();

  function renderTab() {
    switch (tab) {
      case "overview": return <AdminOverview onGoTab={setTab} />;
      case "stores":   return <AdminStores />;
      case "payments": return <AdminPayments />;
      case "stats":    return <AdminPlatformStats />;
      case "settings": return <AdminSettings />;
      case "api":      return <AdminApiModel />;
      case "db":       return <AdminDbHealth />;
      case "revenue":  return <AdminRevenue />;
      case "activity": return <AdminActivity />;
      case "comms":    return <AdminComms />;
      default:         return null;
    }
  }

  return (
    <div className="ad-shell">
      {/* Mobile backdrop */}
      <div
        className={`ad-sidebar-backdrop ${menuOpen ? "is-open" : ""}`}
        onClick={() => setMenuOpen(false)}
        role="presentation"
      />

      {/* Sidebar */}
      <aside className={`ad-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="ad-sidebar-brand">
          <Link to="/">
            <Logo dark />
          </Link>
          <button
            type="button"
            className="ad-sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <div className="ad-sidebar-admin">
          <span className="ad-sidebar-avatar">{initial}</span>
          <div className="ad-sidebar-admin-info">
            <span className="ad-sidebar-admin-label">Admin</span>
            <span className="ad-sidebar-admin-email">
              {admin?.email || "admin"}
            </span>
            <span className="ad-admin-pill">
              <ShieldAlert size={9} strokeWidth={2.5} />
              Super Admin
            </span>
          </div>
        </div>

        <nav className="ad-nav" aria-label="Admin navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="ad-nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ad-nav-item ${tab === item.id ? "active" : ""}`}
                  onClick={() => setTab(item.id)}
                >
                  <item.icon size={17} strokeWidth={2} />
                  {item.label}
                  {item.id === 'payments' && pendingCount > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      minWidth: 18,
                      height: 18,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                    }}>
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="ad-sidebar-footer">
          <button
            type="button"
            className="btn btn-ghost ad-logout-btn"
            onClick={logout}
          >
            <LogOut size={16} strokeWidth={2.25} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ad-main">
        {/* Topbar */}
        <header className="ad-topbar">
          <button
            type="button"
            className="ad-topbar-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <h1 className="ad-topbar-title">{activeTab?.label || "Admin"}</h1>

          <div className="ad-topbar-right">
            <span className="ad-admin-badge">
              <ShieldCheck size={13} strokeWidth={2.5} />
              Admin Panel
            </span>

            <div className="ad-user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="ad-user-chip"
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <span className="ad-avatar">{initial}</span>
                <span className="ad-user-chip-name">
                  {admin?.email || "Admin"}
                </span>
                <ChevronDown size={14} />
              </button>

              {userMenuOpen && (
                <div className="ad-user-dropdown">
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Tab content */}
        <div className="ad-content">{renderTab()}</div>
      </div>
    </div>
  );
}
