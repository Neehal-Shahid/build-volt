import { useEffect, useMemo, useState } from "react";
import { Palette, Eye, ExternalLink, Save, Zap, ZapOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, API_URL } from "../lib/api";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";
import Alert from "./ui/Alert";

// Calculate perceived luminance of a hex colour (0=dark, 1=bright)
function hexLuminance(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export default function WidgetSettingsTab({ store }) {
  const { token, persistSession } = useAuth();
  const [form, setForm] = useState({
    brandColor: "#2A5EE8",
    widgetBg: "#0A1A2D",
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
  const [previewDark, setPreviewDark] = useState(true);

  useEffect(() => {
    if (!store) return;
    setForm({
      brandColor:    store.brandColor    || "#2A5EE8",
      widgetBg:      store.widgetBg      || "#0A1A2D",
      currency:      store.currency      || "PKR",
      widgetTitle:   store.widgetTitle   || "BuildBot",
      welcomeMsg:    store.welcomeMsg    || "",
      buttonText:    store.buttonText    || "Get Started",
      widgetEnabled: store.widgetEnabled !== false,
    });
  }, [store]);

  async function saveAll(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/api/widget-settings", { method: "PUT", token, body: form });
      if (data.store) persistSession(token, data.store);
      setMessage("Widget settings saved");
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  // Toggle widget enabled separately for instant feedback
  async function toggleWidget() {
    const next = !form.widgetEnabled;
    setForm((f) => ({ ...f, widgetEnabled: next }));
    setBusyToggle(true);
    setError("");
    setMessage("");
    try {
      const data = await api("/api/widget-settings", {
        method: "PUT", token,
        body: { ...form, widgetEnabled: next },
      });
      if (data.store) persistSession(token, data.store);
      setMessage(next ? "Widget enabled" : "Widget disabled");
    } catch (err) {
      setForm((f) => ({ ...f, widgetEnabled: !next })); // revert
      setError(err.message || "Save failed");
    } finally {
      setBusyToggle(false);
    }
  }

  // Auto-detect text colour for the preview pane
  const lum = hexLuminance(form.widgetBg || "#0A1A2D");
  const textColor = lum > 0.35 ? "#111827" : "#f8fafc";
  const textMuted  = lum > 0.35 ? "rgba(17,24,39,0.6)" : "rgba(248,250,252,0.7)";

  const previewStyle = useMemo(() => ({
    background: form.widgetBg,
    borderRadius: 14,
    padding: "1.25rem",
    color: textColor,
  }), [form.widgetBg, textColor]);

  return (
    <>
      <PageHeader
        title="Widget Settings"
        description="Customize how the BuildBot shopper widget looks and behaves on your site."
      />

      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      {/* Prominent enable/disable toggle */}
      <Card>
        <div className="sd-widget-toggle-row">
          <div>
            <div className="sd-widget-toggle-title">
              {form.widgetEnabled ? <Zap size={18} color="#059669" /> : <ZapOff size={18} color="#b45309" />}
              Widget is <strong style={{ color: form.widgetEnabled ? "#059669" : "#b45309" }}>
                {form.widgetEnabled ? "Enabled" : "Disabled"}
              </strong>
            </div>
            <p className="muted tiny" style={{ margin: "0.2rem 0 0" }}>
              {form.widgetEnabled
                ? "Shoppers can see and interact with your widget."
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
            ⚠ Your widget is disabled. Shoppers will not see it until you re-enable it.
          </div>
        )}
      </Card>

      <div className="settings-grid">
        {/* Appearance form */}
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
              <span className="muted tiny">Used for the start button and accent highlights.</span>
            </div>

            <div className="sd-field">
              <span className="sd-field-label">Panel background</span>
              <div className="sd-color-field">
                <input
                  type="color"
                  value={form.widgetBg}
                  onChange={(e) => setForm((f) => ({ ...f, widgetBg: e.target.value }))}
                />
                <code>{form.widgetBg}</code>
              </div>
              <span className="muted tiny">Text color auto-adjusts for readability.</span>
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

            <button className="btn" type="submit" disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <Save size={15} /> {busy ? "Saving…" : "Save settings"}
            </button>
          </form>
        </Card>

        {/* Live preview */}
        <Card title="Live preview" icon={Eye}>
          {/* Mock background toggle */}
          <div className="sd-preview-bg-row">
            <span className="muted tiny">Preview background:</span>
            <button
              type="button"
              className={`sd-preview-bg-btn ${previewDark ? "active" : ""}`}
              onClick={() => setPreviewDark(true)}
            >Dark site</button>
            <button
              type="button"
              className={`sd-preview-bg-btn ${!previewDark ? "active" : ""}`}
              onClick={() => setPreviewDark(false)}
            >Light site</button>
          </div>

          {/* Mock site + floating launcher */}
          <div
            className="sd-preview-site"
            style={{ background: previewDark ? "#18181b" : "#f5f5f5" }}
          >
            <div className="sd-preview-site-content">
              <div className="sd-preview-site-bar" style={{ background: previewDark ? "#27272a" : "#e4e4e7" }} />
              <div className="sd-preview-site-bar short" style={{ background: previewDark ? "#27272a" : "#e4e4e7" }} />
              <div className="sd-preview-site-bar" style={{ background: previewDark ? "#27272a" : "#e4e4e7" }} />
            </div>
            {/* Floating launcher */}
            <div className="sd-preview-launcher" style={{ background: form.brandColor }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>

          {/* Widget panel preview */}
          <div style={{ ...previewStyle, marginTop: "0.85rem" }}>
            <strong style={{ display: "block", marginBottom: 8, color: textColor }}>
              {form.widgetTitle || "BuildBot"}
            </strong>
            <p style={{ margin: "0 0 12px", color: textMuted, lineHeight: 1.45, fontSize: "0.9rem" }}>
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
              style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "var(--blue)", fontWeight: 700 }}
            >
              Open live test page <ExternalLink size={13} />
            </a>
          </p>
        </Card>
      </div>
    </>
  );
}
