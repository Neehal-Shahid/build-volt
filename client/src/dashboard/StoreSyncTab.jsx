import { useEffect, useState } from "react";
import {
  Store, RefreshCw, Download, KeyRound, Unlink,
  ShieldCheck, CheckCircle, Copy, Check, Wifi, WifiOff,
  ClipboardList, Link2
} from "lucide-react";
import { api, API_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { getCatalogMode, setCatalogMode } from "../lib/catalogMode";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";
import Alert from "./ui/Alert";
import Badge from "./ui/Badge";

export default function StoreSyncTab({ store, mode, onModeChange }) {
  const { token, refreshStore } = useAuth();
  const [status, setStatus] = useState(null);
  const [secretOnce, setSecretOnce] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  async function loadStatus() {
    const res = await api("/api/plugin/status", { token });
    setStatus(res);
  }

  useEffect(() => {
    if (!token) return;
    loadStatus().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function choose(next) {
    setCatalogMode(next);
    onModeChange(next);
  }

  async function generateKey() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api("/api/plugin/generate-key", { method: "POST", token });
      setSecretOnce(res.pluginSecret || "");
      setMessage(res.message || "Secret generated");
      setCatalogMode("woo");
      onModeChange("woo");
      await loadStatus();
      if (refreshStore) await refreshStore();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect WooCommerce and invalidate the plugin secret?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api("/api/plugin/disconnect", { method: "POST", token });
      setSecretOnce("");
      setMessage(res.message || "Disconnected");
      setCatalogMode("custom");
      onModeChange("custom");
      await loadStatus();
      if (refreshStore) await refreshStore();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text, setter) {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 1800);
    } catch { /* ignore */ }
  }

  const zipUrl = `${API_URL}/buildbot-woocommerce.zip`;
  const wooConnected = status?.wooConnected || store?.wooConnected;
  const lastSync = status?.wooLastSync || store?.wooLastSync;

  const MODES = [
    {
      id: "custom",
      Icon: ClipboardList,
      label: "Manual / CSV",
      desc: "Manage your product catalog directly in the Products tab.",
      bullets: ["Upload products manually", "Use CSV import", "Works with any website"],
    },
    {
      id: "woo",
      Icon: Link2,
      label: "WooCommerce",
      desc: "Automatically sync your WordPress product catalog.",
      bullets: ["Real-time sync from WooCommerce", "No manual uploads needed", "Plugin injects widget automatically"],
    },
  ];

  return (
    <>
      <PageHeader
        title="My Store"
        description="Store details, catalog connection, and WooCommerce integration."
      />

      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      {/* Store info */}
      <Card title="Store details" icon={Store}>
        <div className="sd-info-rows">
          <div className="sd-info-row">
            <span className="sd-info-label">Store name</span>
            <span className="sd-info-value">{store?.name || "—"}</span>
          </div>
          <div className="sd-info-row">
            <span className="sd-info-label">Email</span>
            <span className="sd-info-value">{store?.email}</span>
          </div>
          <div className="sd-info-row">
            <span className="sd-info-label">Store ID</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <code style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{store?.id}</code>
              <button
                type="button"
                className="sd-icon-btn"
                title="Copy Store ID"
                onClick={() => copyText(store?.id || "", setCopiedId)}
              >
                {copiedId ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>
          <div className="sd-info-row">
            <span className="sd-info-label">WooCommerce</span>
            <Badge tone={wooConnected ? "green" : "gray"}>
              {wooConnected
                ? <><Wifi size={11} style={{ marginRight: 3 }} /> Connected</>
                : <><WifiOff size={11} style={{ marginRight: 3 }} /> Not connected</>
              }
            </Badge>
          </div>
          {wooConnected && (
            <div className="sd-info-row">
              <span className="sd-info-label">Last sync</span>
              <span className="sd-info-value">
                {lastSync ? new Date(lastSync).toLocaleString() : "—"}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Catalog mode illustrated cards */}
      <Card title="Catalog mode" icon={RefreshCw}>
        <p className="muted" style={{ marginTop: 0, marginBottom: "1rem" }}>
          Choose how you manage your product catalog. You can switch at any time.
        </p>
        <div className="sd-mode-grid">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`sd-mode-card${mode === m.id ? " selected" : ""}`}
              onClick={() => choose(m.id)}
            >
              <div className="sd-mode-check">
                {mode === m.id && <Check size={13} strokeWidth={3} />}
              </div>
              <span className="sd-mode-icon-wrap">
                <m.Icon size={22} strokeWidth={1.75} />
              </span>
              <strong className="sd-mode-label">{m.label}</strong>
              <p className="sd-mode-desc">{m.desc}</p>
              <ul className="sd-mode-bullets">
                {m.bullets.map((b) => (
                  <li key={b}><CheckCircle size={11} strokeWidth={2.5} /> {b}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </Card>

      {/* WooCommerce plugin — only visible when WooCommerce mode is selected */}
      {mode === "woo" && (
        <Card title="WooCommerce integration" icon={KeyRound}>
          <div className="sd-woo-status-row">
            <div className={`sd-woo-status-badge ${wooConnected ? "connected" : "disconnected"}`}>
              {wooConnected
                ? <><Wifi size={14} /> Plugin connected</>
                : <><WifiOff size={14} /> Not connected</>
              }
            </div>
            {wooConnected && lastSync && (
              <span className="muted tiny">Last sync: {new Date(lastSync).toLocaleString()}</span>
            )}
          </div>

          <ol className="sd-numbered-steps">
            <li>Download the plugin zip and install it in WordPress.</li>
            <li>Go to <strong>Settings → BuildBot</strong> in your WordPress admin.</li>
            <li>Enter your <strong>Store ID</strong> and the <strong>secret</strong> generated below.</li>
            <li>Click <strong>Test connection</strong>, then <strong>Sync catalog</strong>.</li>
          </ol>

          <div className="actions" style={{ marginTop: "1rem", flexWrap: "wrap" }}>
            <a className="btn" href={zipUrl} download
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <Download size={16} strokeWidth={2.25} /> Download plugin
            </a>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={generateKey}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <KeyRound size={16} strokeWidth={2.25} />
              {status?.hasSecret ? "Regenerate secret" : "Generate secret"}
            </button>
            {(status?.hasSecret || wooConnected) && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={disconnect}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#b91c1c" }}
              >
                <Unlink size={16} strokeWidth={2.25} /> Disconnect
              </button>
            )}
          </div>

          {/* Secret reveal with copy button */}
          {secretOnce && (
            <div className="sd-secret-banner">
              <div className="sd-secret-header">
                <ShieldCheck size={16} />
                <strong>Copy this secret now — it will NOT be shown again.</strong>
              </div>
              <div className="sd-embed-block" style={{ marginTop: "0.75rem" }}>
                <pre className="sd-embed-pre">{secretOnce}</pre>
                <button
                  type="button"
                  className="sd-embed-copy-btn"
                  onClick={() => copyText(secretOnce, setCopiedSecret)}
                >
                  {copiedSecret ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
              <p className="muted tiny" style={{ marginTop: "0.5rem" }}>
                Store ID: <code>{store?.id}</code>
              </p>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
