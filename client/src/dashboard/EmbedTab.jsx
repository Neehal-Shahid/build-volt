import { useState } from "react";
import { Copy, Check, ExternalLink, Code2, Zap, ZapOff, ArrowRight, ListChecks } from "lucide-react";
import { API_URL } from "../lib/api";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";

const STEPS = [
  { id: 1, label: "Copy the embed snippet",                      desc: "Click the Copy button above." },
  { id: 2, label: "Open your website's HTML editor",            desc: "Go to your site's theme or page settings." },
  { id: 3, label: "Paste the snippet before </body>",           desc: "The widget will appear as a floating button." },
  { id: 4, label: "Open your site and confirm the launcher",    desc: "Look for the BuildBot button at bottom-right." },
  { id: 5, label: "Test the full widget flow",                   desc: "Click it — answer the 3 questions — get recommendations." },
];

function LIVE_KEY(storeId) { return `bb_widget_live_${storeId}`; }
function STEPS_KEY(storeId) { return `bb_embed_steps_${storeId}`; }

export default function EmbedTab({ store }) {
  const [copied, setCopied] = useState(false);
  const [isLive, setIsLive] = useState(
    () => localStorage.getItem(LIVE_KEY(store?.id)) === "1"
  );
  const [checkedSteps, setCheckedSteps] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STEPS_KEY(store?.id)) || "[]");
    } catch { return []; }
  });

  const snippet = `<script src="${API_URL}/widget.js" data-store-id="${store?.id || "YOUR_STORE_ID"}"></script>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  function toggleLive() {
    const next = !isLive;
    localStorage.setItem(LIVE_KEY(store?.id), next ? "1" : "0");
    setIsLive(next);
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

      {/* Status banner */}
      <div className={`sd-live-status-banner ${isLive ? "live" : "offline"}`}>
        {isLive
          ? <><Zap size={18} strokeWidth={2.5} /><span>Widget is <strong>Live</strong> on your site</span></>
          : <><ZapOff size={18} strokeWidth={2.5} /><span>Widget not yet installed on your site</span></>
        }
        <button type="button" className="sd-live-toggle-btn" onClick={toggleLive}>
          {isLive ? "Mark as offline" : "Mark as live"}
        </button>
      </div>

      {/* Embed code */}
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

      {/* Visual installation checklist */}
      <Card title="Installation checklist" icon={ListChecks}>
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
        {allChecked && (
          <div className="sd-install-done">
            🎉 All steps complete — your widget is ready!
          </div>
        )}
      </Card>

      {/* What happens next */}
      <Card title="What happens next">
        <div className="sd-how-grid">
          {[
            { emoji: "🛍️", label: "Shopper visits your site",   desc: "They see the BuildBot launcher button." },
            { emoji: "💬", label: "Widget asks 3 questions",    desc: "Purpose, budget, and preferences." },
            { emoji: "🤖", label: "AI generates picks",         desc: "Claude AI matches products to their answers." },
            { emoji: "📊", label: "You see analytics",          desc: "Every recommendation appears in your Analytics tab." },
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
