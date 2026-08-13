import { useEffect, useMemo, useState } from "react";
import { Palette, Eye, ExternalLink, Save, Zap, ZapOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, API_URL } from "../lib/api";
import { getWidgetStatus, WIDGET_STATUS_LABELS, isWidgetPaused, widgetPauseHint } from "../lib/widgetStatus";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";
import Alert from "./ui/Alert";

const PANEL_BG = "#FFFFFF";
const PANEL_TEXT = "#0A1A2D";
const PANEL_TEXT_MUTED = "#64748B";

export default function WidgetSettingsTab({ store }) {
  const { token, persistSession } = useAuth();
  const [form, setForm] = useState({
    brandColor: "#2A5EE8",
    currency: "PKR",
    widgetTitle: "BuildBot",
    welcomeMsg: "",
    buttonText: "Get Started",
    widgetEnabled: true,
  });
  const [busy, setBusy] = useState(false);
  const [busyToggle, setBusyToggle] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!store) return;
    setForm({
      brandColor: store.brandColor || "#2A5EE8",
      currency: store.currency || "PKR",
      widgetTitle: store.widgetTitle || "BuildBot",
      welcomeMsg: store.welcomeMsg || "",
      buttonText: store.buttonText || "Get Started",
      widgetEnabled: store.widgetEnabled !== false,
    });
  }, [store]);

  const widgetStatus = getWidgetStatus(store);
  const paused = isWidgetPaused(store);
  const pauseHint = widgetPauseHint(store);

  async function saveAll(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/api/widget-settings", {
        method: "PUT",
        token,
        body: { ...form, widgetBg: PANEL_BG },
      });
      if (data.store) persistSession(token, data.store);
      setMessage("Widget settings saved");
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleWidget() {
    const next = !form.widgetEnabled;
    setForm((f) => ({ ...f, widgetEnabled: next }));
    setBusyToggle(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/api/widget-settings", {
        method: "PUT",
        token,
        body: { ...form, widgetEnabled: next, widgetBg: PANEL_BG },
      });
      if (data.store) persistSession(token, data.store);
      setMessage(next ? "Widget enabled" : "Widget disabled");
    } catch (err) {
      setForm((f) => ({ ...f, widgetEnabled: !next }));
      setError(err.message || "Save failed");
    } finally {
      setBusyToggle(false);
    }
  }

  const previewStyle = useMemo(
    () => ({
      background: PANEL_BG,
      borderRadius: 14,
      padding: "1.25rem",
      color: PANEL_TEXT,
      border: "1px solid #E2E8F0",
      boxShadow: "0 4px 24px rgba(10, 26, 45, 0.08)",
    }),
    [],
  );

  return (
    <>
      <PageHeader
        title="Widget Settings"
        description="Customize how the BuildBot shopper widget looks and behaves on your site."
      />

      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      {paused && (
        <div className="sd-banner warn">
          <p style={{ margin: 0 }}>
            {pauseHint || "Your widget is paused."} Shoppers cannot use it until you upgrade or renew.
          </p>
        </div>
      )}

      <Card>
        <div className="sd-widget-toggle-row">
          <div>
            <div className="sd-widget-toggle-title">
              {form.widgetEnabled ? (
                <Zap size={18} color="#059669" />
              ) : (
                <ZapOff size={18} color="#b45309" />
              )}
              Widget is{" "}
              <strong style={{ color: form.widgetEnabled ? "#059669" : "#b45309" }}>
                {form.widgetEnabled ? "Enabled" : "Disabled"}
              </strong>
              <span className="muted tiny" style={{ marginLeft: "0.5rem" }}>
                · {WIDGET_STATUS_LABELS[widgetStatus]}
              </span>
            </div>
            <p className="muted tiny" style={{ margin: "0.2rem 0 0" }}>
              {form.widgetEnabled
                ? widgetStatus === "not_installed"
                  ? "Enabled, but shoppers won't see it until you install the embed snippet on your site."
                  : "Shoppers can see and interact with your widget."
                : "The widget is hidden from all shoppers on your site."}
            </p>
          </div>
          <button
            type="button"
            className={`sd-big-toggle ${form.widgetEnabled ? "on" : "off"}`}
            onClick={toggleWidget}
            disabled={busyToggle}
            aria-pressed={form.widgetEnabled}
          >
            <span className="sd-big-toggle-thumb" />
          </button>
        </div>
        {!form.widgetEnabled && (
          <div className="sd-notice warning" style={{ marginTop: "0.75rem" }}>
            Your widget is disabled. Shoppers will not see it until you re-enable it.
          </div>
        )}
        {form.widgetEnabled && widgetStatus === "not_installed" && (
          <div className="sd-notice warning" style={{ marginTop: "0.75rem" }}>
            Install the embed snippet from the Go Live tab, then confirm installation there.
          </div>
        )}
      </Card>

      <div className="settings-grid">
        <Card title="Appearance" icon={Palette}>
          <form className="sd-form" onSubmit={saveAll}>
            <div className="sd-field">
              <span className="sd-field-label">Brand color</span>
              <div className="sd-color-field">
                <input
                  type="color"
                  value={form.brandColor}
                  onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value }))}
                />
                <code>{form.brandColor}</code>
              </div>
              <span className="muted tiny">
                Used for the launcher button, CTA, and accent highlights. Panel background is always white for readability.
              </span>
            </div>

            <label className="sd-field">
              <span className="sd-field-label">Currency symbol</span>
              <input
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                maxLength={8}
              />
            </label>

            <label className="sd-field">
              <span className="sd-field-label">Widget title</span>
              <input
                value={form.widgetTitle}
                onChange={(e) => setForm((f) => ({ ...f, widgetTitle: e.target.value }))}
                maxLength={60}
                required
              />
            </label>

            <label className="sd-field">
              <span className="sd-field-label">Welcome message</span>
              <textarea
                rows={3}
                value={form.welcomeMsg}
                onChange={(e) => setForm((f) => ({ ...f, welcomeMsg: e.target.value }))}
                maxLength={500}
              />
            </label>

            <label className="sd-field">
              <span className="sd-field-label">Start button text</span>
              <input
                value={form.buttonText}
                onChange={(e) => setForm((f) => ({ ...f, buttonText: e.target.value }))}
                maxLength={40}
                required
              />
            </label>

            <button
              className="btn"
              type="submit"
              disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Save size={15} /> {busy ? "Saving…" : "Save settings"}
            </button>
          </form>
        </Card>

        <Card title="Preview" icon={Eye}>
          <div className="sd-preview-site" style={{ background: "#F8FAFC" }}>
            <div className="sd-preview-site-content">
              <div className="sd-preview-site-bar" style={{ background: "#E2E8F0" }} />
              <div className="sd-preview-site-bar short" style={{ background: "#E2E8F0" }} />
              <div className="sd-preview-site-bar" style={{ background: "#E2E8F0" }} />
            </div>
            <div className="sd-preview-launcher" style={{ background: form.brandColor }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
          </div>

          <div style={{ ...previewStyle, marginTop: "0.85rem" }}>
            <strong style={{ display: "block", marginBottom: 8, color: PANEL_TEXT }}>
              {form.widgetTitle || "BuildBot"}
            </strong>
            <p
              style={{
                margin: "0 0 12px",
                color: PANEL_TEXT_MUTED,
                lineHeight: 1.45,
                fontSize: "0.9rem",
              }}
            >
              {form.welcomeMsg || "Welcome message will appear here…"}
            </p>
            <button
              type="button"
              style={{
                background: form.brandColor,
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "0.6rem 1.2rem",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
                width: "100%",
              }}
            >
              {form.buttonText || "Get Started"}
            </button>
          </div>

          <p className="muted tiny" style={{ marginTop: "0.9rem", marginBottom: 0 }}>
            <a
              href={`${API_URL}/widget-test?storeId=${encodeURIComponent(store?.id || "")}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                color: "var(--blue)",
                fontWeight: 700,
              }}
            >
              Open live test page <ExternalLink size={13} />
            </a>
          </p>
        </Card>
      </div>
    </>
  );
}
