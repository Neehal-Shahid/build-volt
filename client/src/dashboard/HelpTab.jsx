import { useEffect, useState } from "react";
import { LifeBuoy, Send, MessagesSquare, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";
import Alert from "./ui/Alert";
import Badge from "./ui/Badge";
import EmptyState from "./ui/EmptyState";
import { SkeletonRows } from "./ui/Skeleton";

const FAQS = [
  {
    q: "How do I install the widget on my site?",
    a: "Go to the 'Go Live' tab in the sidebar. Copy the embed snippet and paste it just before the </body> tag on your website. The widget will appear as a floating button — no other configuration needed.",
  },
  {
    q: "My widget isn't showing up. What should I check?",
    a: "First, verify the widget is Enabled in Widget Settings. Then confirm the embed snippet is correctly placed before </body>. Open the test page from the Go Live tab to verify it works in isolation.",
  },
  {
    q: "How does WooCommerce sync work?",
    a: "Download the BuildBot WordPress plugin from the 'My Store' tab, install it in WordPress, generate a secret key, and configure your Store ID + secret in the plugin settings. Products sync automatically after that.",
  },
  {
    q: "What happens when my trial ends?",
    a: "If your trial expires, your widget will be paused and shoppers won't see it. You can reactivate it at any time by upgrading to a paid plan from the Billing tab — no data is lost.",
  },
  {
    q: "How long does manual payment approval take?",
    a: "After you submit a JazzCash or EasyPaisa transaction ID, our team typically reviews it within a few hours during business hours. You'll receive a confirmation email once your plan is activated.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`sd-faq-item${open ? " open" : ""}`}>
      <button type="button" className="sd-faq-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{q}</span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && <div className="sd-faq-answer">{a}</div>}
    </div>
  );
}

export default function HelpTab() {
  const { token } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api("/api/support", { token });
    setTickets(res.tickets || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(""); setOk("");
    try {
      await api("/api/support", { method: "POST", token, body: { subject, message } });
      setOk("Ticket submitted — we'll get back to you by email within 24 hours.");
      setSubject(""); setMessage("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Help & Support"
        description="Find answers to common questions or contact our team."
      />

      {/* FAQs first */}
      <Card title="Frequently asked questions" icon={LifeBuoy}>
        <div className="sd-faq-list">
          {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </Card>

      {/* New ticket */}
      <Card title="Contact support" icon={Send}>
        <p className="muted" style={{ marginTop: 0 }}>
          Can't find your answer above? Send us a message and we'll reply within{" "}
          <strong>24 hours</strong>.
        </p>
        <Alert type="success">{ok}</Alert>
        <Alert type="error">{error}</Alert>
        <form className="sd-form" onSubmit={submit}>
          <label className="sd-field">
            <span className="sd-field-label">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </label>
          <label className="sd-field">
            <span className="sd-field-label">Message</span>
            <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required />
          </label>
          <button className="btn" type="submit" disabled={busy}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <Send size={15} /> {busy ? "Sending…" : "Submit ticket"}
          </button>
        </form>
      </Card>

      {/* Ticket history */}
      <Card title="Your tickets" icon={MessagesSquare}>
        {tickets === null ? (
          <SkeletonRows count={2} />
        ) : tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No tickets yet — reach out any time." />
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr><th>Subject</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>{t.subject}</td>
                    <td>
                      <Badge tone={t.status === "closed" ? "gray" : t.status === "open" ? "blue" : "amber"}>
                        {t.status}
                      </Badge>
                    </td>
                    <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
