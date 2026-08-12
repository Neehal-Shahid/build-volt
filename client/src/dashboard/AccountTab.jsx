import { useState } from "react";
import {
  UserCircle, KeyRound, Mail, ShieldAlert,
  Bell, Sparkles, RotateCcw, Send, Check, ArrowLeft
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";
import Alert from "./ui/Alert";

/* ─── inline Forgot-password mini-flow ──────────────────────── */
function ForgotPasswordInline({ email: storeEmail, onBack }) {
  const [step, setStep] = useState("request"); // request | reset | done
  const [email, setEmail] = useState(storeEmail || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devHint, setDevHint] = useState(null);

  async function requestReset(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/forgot-password", { method: "POST", body: { email } });
      setMessage(data.message || "Reset code sent to your email.");
      if (data.devHint) setDevHint(data.devHint);
      setStep("reset");
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/reset-password", {
        method: "POST",
        body: { email, otp, password: newPassword },
      });
      setMessage(data.message || "Password updated successfully.");
      setStep("done");
    } catch (err) {
      setError(err.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sd-form">
      <button
        type="button"
        className="sd-back-link"
        onClick={onBack}
      >
        <ArrowLeft size={14} /> Back to Change Password
      </button>

      {step === "request" && (
        <form className="sd-form" onSubmit={requestReset}>
          <Alert type="error">{error}</Alert>
          <p className="muted" style={{ margin: 0 }}>
            Enter your account email address and we'll send a 6-digit reset code.
          </p>
          <label className="sd-field">
            <span className="sd-field-label">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button className="btn" type="submit" disabled={busy}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <Send size={15} /> {busy ? "Sending…" : "Send reset code"}
          </button>
        </form>
      )}

      {step === "reset" && (
        <form className="sd-form" onSubmit={submitReset}>
          <Alert type="success">{message}</Alert>
          <Alert type="error">{error}</Alert>
          {devHint && (
            <div className="sd-notice info" style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
              Dev mode OTP: <strong>{devHint.otp}</strong>
            </div>
          )}
          <label className="sd-field">
            <span className="sd-field-label">6-digit OTP (from email)</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              required
            />
          </label>
          <label className="sd-field">
            <span className="sd-field-label">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <button className="btn" type="submit" disabled={busy}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <KeyRound size={15} /> {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="sd-install-done" style={{ marginTop: 0 }}>
          <Check size={16} style={{ marginRight: "0.4rem" }} />
          {message || "Password updated successfully."}
        </div>
      )}
    </div>
  );
}

/* ─── Main AccountTab ─────────────────────────────────────────── */
export default function AccountTab({ store }) {
  const { token, refreshStore, logout } = useAuth();

  // Profile
  const [name, setName] = useState(store?.name || "");
  const [profileOk, setProfileOk] = useState("");
  const [profileErr, setProfileErr] = useState("");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordOk, setPasswordOk] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  // Email prefs
  const [marketingOptIn, setMarketingOptIn] = useState(!!store?.marketingOptIn);
  const [prefsOk, setPrefsOk] = useState("");
  const [prefsErr, setPrefsErr] = useState("");

  // Delete
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteErr, setDeleteErr] = useState("");

  const [busy, setBusy] = useState(false);

  const initial = (store?.name || store?.email || "U").trim().charAt(0).toUpperCase();

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    setProfileOk(""); setProfileErr("");
    try {
      await api("/api/settings", { method: "PUT", token, body: { name } });
      await refreshStore();
      setProfileOk("Profile saved");
    } catch (err) { setProfileErr(err.message); }
    finally { setBusy(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    setBusy(true);
    setPasswordOk(""); setPasswordErr("");
    try {
      await api("/api/change-password", { method: "PUT", token, body: { currentPassword, newPassword } });
      setCurrentPassword(""); setNewPassword("");
      setPasswordOk("Password updated");
    } catch (err) { setPasswordErr(err.message); }
    finally { setBusy(false); }
  }

  async function saveEmailPrefs(e) {
    e.preventDefault();
    setBusy(true);
    setPrefsOk(""); setPrefsErr("");
    try {
      await api("/api/email-preferences", { method: "PUT", token, body: { marketingOptIn } });
      await refreshStore();
      setPrefsOk("Preferences saved");
    } catch (err) { setPrefsErr(err.message); }
    finally { setBusy(false); }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    if (!window.confirm("This will permanently delete your account and all data. This cannot be undone. Continue?")) return;
    setBusy(true);
    setDeleteErr("");
    try {
      await api("/api/account", { method: "DELETE", token, body: { password: deletePassword } });
      logout();
    } catch (err) {
      setDeleteErr(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Account" description="Manage your profile, security, and preferences." />

      {/* Profile hero */}
      <div className="sd-profile-hero">
        <div className="sd-profile-avatar">{initial}</div>
        <div className="sd-profile-info">
          <div className="sd-profile-name">{store?.name || "Your store"}</div>
          <div className="sd-profile-email">{store?.email}</div>
          <span className={`sd-plan-pill ${store?.plan === "trial" ? "trial" : "paid"}`}>
            {store?.plan || "trial"}
          </span>
        </div>
      </div>

      {/* Section: Account Settings */}
      <div className="sd-section-label">
        <Sparkles size={14} /> Account settings
      </div>

      <Card title="Profile" icon={UserCircle}>
        <Alert type="success">{profileOk}</Alert>
        <Alert type="error">{profileErr}</Alert>
        <form className="sd-form" onSubmit={saveProfile}>
          <label className="sd-field">
            <span className="sd-field-label">Email</span>
            <input value={store?.email || ""} disabled />
          </label>
          <label className="sd-field">
            <span className="sd-field-label">Store name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <button className="btn btn-ghost" type="submit" disabled={busy}>Save profile</button>
        </form>
      </Card>

      <Card title="Change password" icon={KeyRound}>
        {showForgot ? (
          <ForgotPasswordInline
            email={store?.email || ""}
            onBack={() => setShowForgot(false)}
          />
        ) : (
          <>
            <Alert type="success">{passwordOk}</Alert>
            <Alert type="error">{passwordErr}</Alert>
            <form className="sd-form" onSubmit={savePassword}>
              <label className="sd-field">
                <span className="sd-field-label">Current password</span>
                <input type="password" value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)} required />
              </label>
              <label className="sd-field">
                <span className="sd-field-label">New password</span>
                <input type="password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} required />
              </label>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn btn-ghost" type="submit" disabled={busy}>
                  Update password
                </button>
                <button
                  type="button"
                  className="sd-text-link"
                  onClick={() => { setPasswordOk(""); setPasswordErr(""); setShowForgot(true); }}
                >
                  <RotateCcw size={13} /> Forgot password?
                </button>
              </div>
            </form>
          </>
        )}
      </Card>

      {/* Section: Preferences & Danger */}
      <div className="sd-section-label" style={{ marginTop: "1.5rem" }}>
        <Bell size={14} /> Preferences &amp; danger zone
      </div>

      <Card title="Email notifications" icon={Mail}>
        <Alert type="success">{prefsOk}</Alert>
        <Alert type="error">{prefsErr}</Alert>
        <form className="sd-form" onSubmit={saveEmailPrefs}>
          <div className="sd-toggle-row">
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--navy)" }}>
                Product &amp; marketing emails
              </div>
              <p className="muted tiny" style={{ margin: "0.2rem 0 0" }}>
                Receive updates about new BuildBot features, tips, and offers.
              </p>
            </div>
            <button
              type="button"
              className={`sd-big-toggle ${marketingOptIn ? "on" : "off"}`}
              onClick={() => setMarketingOptIn((v) => !v)}
              aria-pressed={marketingOptIn}
            >
              <span className="sd-big-toggle-thumb" />
            </button>
          </div>
          <button className="btn btn-ghost" type="submit" disabled={busy}>Save preferences</button>
        </form>
      </Card>

      <Card title="Danger zone" icon={ShieldAlert}>
        <div className="sd-danger-card">
          <p>
            Deleting your account permanently removes your store, products, and all recommendation history.
            <strong> This action cannot be undone.</strong>
          </p>
          <form className="sd-form" onSubmit={deleteAccount}>
            <Alert type="error">{deleteErr}</Alert>
            <label className="sd-field">
              <span className="sd-field-label">Confirm your password to continue</span>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
              />
            </label>
            <button
              className="btn"
              type="submit"
              disabled={busy}
              style={{ background: "#b91c1c", color: "#fff", maxWidth: "220px" }}
            >
              Delete my account
            </button>
          </form>
        </div>
      </Card>
    </>
  );
}
