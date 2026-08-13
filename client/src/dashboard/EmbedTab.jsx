import { useState } from "react";
import { Copy, Check, ExternalLink, Code2, Zap, ZapOff, ListChecks } from "lucide-react";
import { API_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { WIDGET_LIVE_KEY, isWidgetInstalled } from "../lib/widgetStatus";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";

const STEPS = [
  { id: 1, label: "Copy the embed snippet", desc: "Use the Copy button below." },
  { id: 2, label: "Paste before </body> on your site", desc: "Add it to your theme footer or page template." },
  { id: 3, label: "Confirm the launcher appears", desc: "Open your site and look for the button at bottom-right." },
  { id: 4, label: "Test the full widget flow", desc: "Answer the 3 questions and verify recommendations load." },
];

function STEPS_KEY(storeId) { return `bb_embed_steps_${storeId}`; }

export default function EmbedTab({ store }) {
  const { refreshStore } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isLive, setIsLive] = useState(() => isWidgetInstalled(store));
  const [checkedSteps, setCheckedSteps] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STEPS_KEY(store?.id)) || "[]");
    } catch { return []; }
  });

  const snippet = `<script src="${API_URL}/widget.js" data-store-id="${store?.id || "YOUR_STORE_ID"}"></script>`;
  const serverDetected = !!(store?.widgetLastSeen || store?.widgetInstalledAt);
  const lastSeenLabel = store?.widgetLastSeen
    ? new Date(store.widgetLastSeen).toLocaleString()
    : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  function confirmInstall() {
    localStorage.setItem(WIDGET_LIVE_KEY(store?.id), "1");
    setIsLive(true);
    window.dispatchEvent(new Event("bb-widget-live-change"));
    refreshStore?.().catch(() => {});
  }

  function markOffline() {
    localStorage.setItem(WIDGET_LIVE_KEY(store?.id), "0");
    setIsLive(false);
    window.dispatchEvent(new Event("bb-widget-live-change"));
  }

  function toggleStep(id) {
    const next = checkedSteps.includes(id)
      ? checkedSteps.filter((s) => s !== id)
      : [...checkedSteps, id];
    setCheckedSteps(next);
    localStorage.setItem(STEPS_KEY(store?.id), JSON.stringify(next));
  }

  const allChecked = STEPS.every((s) => checkedSteps.includes(s.id));

  return (
    <>
      <PageHeader
        title="Go Live"
        description="Install the BuildBot widget on your store site in minutes."
      />

      <div className={`sd-live-status-banner ${isLive || serverDetected ? "live" : "offline"}`}>
        {isLive || serverDetected ? (
          <>
            <Zap size={18} strokeWidth={2.5} />
            <span>
              {serverDetected ? (
                <>
                  Widget <strong>detected on your site</strong>
                  {lastSeenLabel ? ` · last seen ${lastSeenLabel}` : ""}
                </>
              ) : (
                <>Installation confirmed — widget is marked as <strong>installed</strong> on your site.</>
              )}
            </span>
          </>
        ) : (
          <>
            <ZapOff size={18} strokeWidth={2.5} />
            <span>
              Widget not yet confirmed on your site. Complete the steps below, then confirm installation.
            </span>
          </>
        )}
        {isLive ? (
          <button type="button" className="sd-live-toggle-btn" onClick={markOffline}>
            Undo confirmation
          </button>
        ) : (
          <button type="button" className="sd-live-toggle-btn primary" onClick={confirmInstall}>
            Confirm installation
          </button>
        )}
      </div>

      <Card title="Embed snippet" icon={Code2}>
        <p className="muted" style={{ marginTop: 0 }}>
          Paste this single script tag just before the <code>&lt;/body&gt;</code> tag on every page of your store.
        </p>
        <div className="sd-embed-block">
          <pre className="sd-embed-pre">{snippet}</pre>
          <button type="button" className="sd-embed-copy-btn" onClick={copy}>
            {copied ? <><Check size={14} strokeWidth={2.5} /> Copied!</> : <><Copy size={14} strokeWidth={2} /> Copy</>}
          </button>
        </div>
        <div className="actions" style={{ marginTop: "1rem" }}>
          <a
            className="btn btn-ghost"
            href={`${API_URL}/widget-test?storeId=${encodeURIComponent(store?.id || "")}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <ExternalLink size={15} /> Open test page
          </a>
        </div>
      </Card>

      <Card title="Installation checklist" icon={ListChecks}>
        <p className="muted tiny" style={{ margin: "0 0 0.85rem" }}>
          Work through each step, then click <strong>Confirm installation</strong> above.
        </p>
        <div className="sd-install-steps">
          {STEPS.map((s) => {
            const done = checkedSteps.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`sd-install-step${done ? " done" : ""}`}
                onClick={() => toggleStep(s.id)}
              >
                <span className={`sd-install-check${done ? " done" : ""}`}>
                  {done ? <Check size={12} strokeWidth={3} /> : <span>{s.id}</span>}
                </span>
                <div className="sd-install-step-text">
                  <strong>{s.label}</strong>
                  <span className="muted tiny">{s.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
        {allChecked && !isLive && (
          <div className="sd-install-done">
            All steps checked — click <strong>Confirm installation</strong> to update your dashboard status.
          </div>
        )}
        {allChecked && isLive && (
          <div className="sd-install-done">
            Installation complete. Enable the widget in Widget Settings if you haven't already.
          </div>
        )}
      </Card>

      <Card title="What happens next">
        <div className="sd-how-grid">
          {[
            { emoji: "🛍️", label: "Shopper visits your site", desc: "They see the BuildBot launcher button." },
            { emoji: "💬", label: "Widget asks 3 questions", desc: "Purpose, budget, and preferences." },
            { emoji: "🤖", label: "AI generates picks", desc: "Claude AI matches products to their answers." },
            { emoji: "📊", label: "You see analytics", desc: "Every recommendation appears in your Analytics tab." },
          ].map((s) => (
            <div key={s.label} className="sd-how-step">
              <span className="sd-how-icon" style={{ fontSize: "1.5rem" }}>{s.emoji}</span>
              <strong>{s.label}</strong>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
