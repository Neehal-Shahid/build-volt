import { useEffect, useState } from "react";
import {
  CreditCard, Landmark, History, Shield, CheckCircle,
  Clock, TrendingUp, Zap, Smartphone, Banknote, Sparkles, Receipt
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import DemoCheckout from "./DemoCheckout";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import EmptyState from "./ui/EmptyState";
import Alert from "./ui/Alert";
import { SkeletonStats, SkeletonCard } from "./ui/Skeleton";
import { isPlanLapsed } from "../lib/widgetStatus";

function relTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d >= 1) return `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  return "today";
}

const PLAN_FEATURES = {
  starter: ["500 recommendations / month", "Manual & CSV catalog", "Email support", "Widget customization"],
  growth:  ["2,000 recommendations / month", "WooCommerce sync",    "Priority support",  "Advanced analytics"],
  pro:     ["5,000 recommendations / month", "Everything in Growth", "Dedicated support", "Early access to new features"],
};

const METHODS = [
  { id: "JazzCash",  label: "JazzCash",  Icon: Smartphone },
  { id: "EasyPaisa", label: "EasyPaisa", Icon: Banknote },
];

export default function BillingTab({ store }) {
  const { token, persistSession } = useAuth();
  const [plans, setPlans] = useState([]);
  const [paymentNumber, setPaymentNumber] = useState("");
  const [history, setHistory] = useState([]);
  const [current, setCurrent] = useState(null);
  const [demoEnabled, setDemoEnabled] = useState(true);
  const [jazzcashEnabled, setJazzcashEnabled] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [method, setMethod] = useState("JazzCash");
  const [transactionRef, setTransactionRef] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(preserveMessage = false) {
    setLoading(true);
    if (!preserveMessage) setError("");
    try {
      const [plansRes, histRes] = await Promise.all([
        api("/api/plans"),
        api("/api/payment/history", { token }),
      ]);
      setPlans(plansRes.plans || []);
      setPaymentNumber(plansRes.paymentNumber || histRes.paymentNumber || "");
      setHistory(histRes.payments || []);
      setCurrent(histRes.current || null);
      setDemoEnabled(plansRes.demoEnabled !== false);
      setJazzcashEnabled(plansRes.jazzcashEnabled !== false);
      if (histRes.store) persistSession(token, histRes.store);
    } catch (err) {
      setError(err.message || "Could not load billing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (token) load(); }, [token]);

  const selected = plans.find((p) => p.id === selectedPlan) || plans[0];

  function confirmRepeatPurchase(planId) {
    const hasActivePaid = store?.plan && store.plan !== "trial" && !isPlanLapsed(store);
    if (!hasActivePaid) return true;
    const endsLabel = store.planEnds
      ? new Date(store.planEnds).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
      : "soon";
    if (store.plan === planId) {
      return window.confirm(
        `You already have an active ${store.plan} plan until ${endsLabel}. Paying again will extend it by 30 more days from that date — you won't lose any remaining time. Continue?`,
      );
    }
    return window.confirm(
      `You're currently on the ${store.plan} plan until ${endsLabel}. Switching to ${planId} starts a new 30-day cycle today. Continue?`,
    );
  }

  async function submitManual(e) {
    e.preventDefault();
    if (!confirmRepeatPurchase(selectedPlan)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api("/api/payment/submit", {
        method: "POST", token,
        body: { plan: selectedPlan, method, transactionRef },
      });
      setMessage(res.message);
      setTransactionRef("");
      await load(true);
    } catch (err) {
      setError(err.message || "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function payDemo(payload) {
    const res = await api("/api/payment/demo-checkout", {
      method: "POST", token, body: payload,
    });
    if (res.token && res.store) persistSession(res.token, res.store);
    return res;
  }

  function handleCheckoutClose(result) {
    setCheckoutOpen(false);
    if (result?.success) {
      const planName = result.receipt?.plan || result.plan?.name || selectedPlan;
      const amount = Number(result.receipt?.amount || selected?.price || 0).toLocaleString();
      setMessage(
        `Payment successful! Your ${planName} plan is now active for 30 days (PKR ${amount} charged). A receipt has been emailed to ${store?.email || "you"}.`,
      );
      setError("");
      load(true);
    } else {
      load();
    }
  }

  function viewReceipt(payment) {
    const date = payment.createdAt ? new Date(payment.createdAt) : new Date();
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = [
      '<!DOCTYPE html><html><head><meta charset="utf-8">',
      `<title>Receipt — ${esc(payment.plan)} plan</title>`,
      "<style>",
      "body{font-family:system-ui,sans-serif;padding:2.5rem;color:#0a1a2d;max-width:520px;margin:0 auto}",
      ".brand{font-size:1.1rem;font-weight:800;margin:0 0 2rem}",
      ".brand span{color:#2a5ee8}",
      "h1{font-size:1.3rem;margin:0 0 .25rem}",
      ".sub{color:#64748b;font-size:.85rem;margin:0 0 1.5rem}",
      "table{width:100%;border-collapse:collapse;font-size:.9rem;margin-bottom:1.5rem}",
      "td{padding:.6rem 0;border-bottom:1px solid #f1f5f9}",
      "td:first-child{color:#64748b}",
      "td:last-child{text-align:right;font-weight:600}",
      ".total td{border-bottom:none;border-top:2px solid #0a1a2d;font-size:1.05rem;font-weight:800;padding-top:.75rem}",
      ".total td:last-child{color:#2a5ee8}",
      ".ft{margin-top:2.5rem;padding-top:1rem;border-top:1px solid #e2e8f0;font-size:.75rem;color:#94a3b8;text-align:center}",
      "@media print{body{padding:1rem}}",
      "</style></head><body>",
      '<div class="brand">Build<span>Bot</span></div>',
      "<h1>Payment receipt</h1>",
      `<p class="sub">${esc(store?.name || store?.email || "")} &nbsp;&middot;&nbsp; ${date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>`,
      "<table>",
      `<tr><td>Plan</td><td style="text-transform:capitalize">${esc(payment.plan)}</td></tr>`,
      `<tr><td>Payment method</td><td>${esc(payment.method)}</td></tr>`,
      payment.transactionRef ? `<tr><td>Reference</td><td>${esc(payment.transactionRef)}</td></tr>` : "",
      `<tr><td>Status</td><td style="text-transform:capitalize">${esc(payment.status)}</td></tr>`,
      `<tr class="total"><td>Total paid</td><td>PKR ${Number(payment.amount).toLocaleString()}</td></tr>`,
      "</table>",
      '<div class="ft">Generated by BuildBot — keep this as your payment record.</div>',
      "</body></html>",
    ].join("\n");
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Billing" description="Manage your plan and payments." />
        <SkeletonStats count={1} />
        <SkeletonCard />
      </>
    );
  }

  const isTrial = store?.plan === "trial";
  const trialDays = store?.trialEnds
    ? Math.max(0, Math.ceil((new Date(store.trialEnds) - Date.now()) / 86400000))
    : null;
  const planDaysLeft = current?.planEnds
    ? Math.max(0, Math.ceil((new Date(current.planEnds) - Date.now()) / 86400000))
    : null;
  const planProgress = planDaysLeft != null ? Math.min(100, ((30 - planDaysLeft) / 30) * 100) : null;
  const planLapsed = isPlanLapsed(store);

  return (
    <>
      <PageHeader title="Billing" description="Manage your plan and payment history." />

      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      {planLapsed && (
        <div className="sd-banner warn">
          <p style={{ margin: 0 }}>
            {store?.plan === "trial"
              ? "Your trial has ended. Choose a plan below to restore your widget and unlock full limits."
              : "Your plan has expired. Renew below to restore your widget and recommendation limits."}
          </p>
        </div>
      )}

      <Card>
        <div className="sd-current-plan-card">
          <div className="sd-current-plan-left">
            <div className="sd-current-plan-eyebrow">Current plan</div>
            <div className="sd-current-plan-name">
              {current?.plan || store?.plan || "Trial"}
              <Badge
                tone={planLapsed ? "red" : isTrial ? "amber" : "green"}
                style={{ marginLeft: "0.5rem", textTransform: "capitalize" }}
              >
                {planLapsed ? "Expired" : isTrial ? "Trial" : "Active"}
              </Badge>
            </div>
            {isTrial && trialDays !== null && (
              <p className="muted tiny" style={{ margin: "0.3rem 0 0" }}>
                <Clock size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
                Trial ends in {trialDays} day{trialDays === 1 ? "" : "s"} — {new Date(store.trialEnds).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
            {!isTrial && current?.period && (
              <p className="muted tiny" style={{ margin: "0.3rem 0 0" }}>
                {current.limit?.toLocaleString()} recs / {current.period}
                {planDaysLeft != null && ` · ${planDaysLeft} days remaining`}
              </p>
            )}
          </div>
          {!isTrial && planProgress != null && (
            <div className="sd-plan-progress">
              <div className="sd-plan-progress-track">
                <div className="sd-plan-progress-fill" style={{ width: `${planProgress}%` }} />
              </div>
              <span className="muted tiny">{planDaysLeft}d left</span>
            </div>
          )}
        </div>
      </Card>

      <div className="plan-grid">
        {plans.map((p) => {
          const features = PLAN_FEATURES[p.id] || [];
          const isSelected = selectedPlan === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`plan-card ${isSelected ? "active" : ""} ${p.id === "growth" ? "popular" : ""}`}
              onClick={() => setSelectedPlan(p.id)}
            >
              {p.id === "growth" && <span className="plan-card-popular">Most Popular</span>}
              {isSelected && (
                <span className="plan-card-badge">
                  <CheckCircle size={12} strokeWidth={2.5} /> Selected
                </span>
              )}
              <strong>{p.name}</strong>
              <span className="plan-price">
                PKR {Number(p.price).toLocaleString()}
                <small>/mo</small>
              </span>
              <span className="muted" style={{ fontSize: "0.8rem" }}>{p.blurb}</span>
              {features.length > 0 && (
                <ul className="plan-features">
                  {features.map((f) => (
                    <li key={f}><CheckCircle size={12} strokeWidth={2.5} /> {f}</li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      {demoEnabled && selected && (
        <Card title="Pay with card" icon={CreditCard}>
          <div className="sd-card-pay-box">
            <div className="sd-card-pay-summary">
              <div className="sd-card-pay-plan">
                <Sparkles size={16} strokeWidth={2} />
                <div>
                  <strong>{selected.name} plan</strong>
                  <span className="muted tiny">30 days · instant activation</span>
                </div>
              </div>
              <div className="sd-card-pay-amount">
                PKR {Number(selected.price).toLocaleString()}
              </div>
            </div>
            <div className="sd-pay-trust">
              <span><Shield size={13} /> Secure checkout</span>
              <span><Zap size={13} /> Instant activation</span>
              <span><CheckCircle size={13} /> 30-day access</span>
            </div>
            <button
              type="button"
              className="btn sd-card-pay-btn"
              onClick={() => {
                if (!confirmRepeatPurchase(selected.id)) return;
                setError("");
                setCheckoutOpen(true);
              }}
            >
              <CreditCard size={16} />
              Pay PKR {Number(selected.price).toLocaleString()}
            </button>
            <p className="muted tiny" style={{ margin: "0.65rem 0 0" }}>
              <Shield size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
              Visa, Mastercard, and Amex accepted. Your card details never touch our servers.
            </p>
          </div>
        </Card>
      )}

      {jazzcashEnabled && (
        <Card title="JazzCash / EasyPaisa" icon={Landmark}>
          <p className="muted tiny" style={{ marginTop: 0, marginBottom: "0.85rem" }}>
            Send payment from your app, then submit the transaction ID below — we'll activate your plan once it's verified.
          </p>
          {paymentNumber ? (
            <div className="sd-pay-number-box">
              <div className="sd-pay-number-label">Send payment to</div>
              <div className="sd-pay-number-value">{paymentNumber}</div>
              <div className="muted tiny">JazzCash / EasyPaisa accepted</div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>Payment account number is configured by admin.</p>
          )}

          <form className="sd-form" style={{ marginTop: "1rem" }} onSubmit={submitManual}>
            <div>
              <span className="sd-field-label" style={{ display: "block", marginBottom: "0.5rem" }}>Payment method</span>
              <div className="sd-method-pills">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`sd-method-pill ${method === m.id ? "active" : ""}`}
                    onClick={() => setMethod(m.id)}
                  >
                    <m.Icon size={14} strokeWidth={2} style={{ marginRight: "0.35rem", verticalAlign: -2 }} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="sd-field">
              <span className="sd-field-label">Transaction ID</span>
              <input
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g. JC123456789"
                required
                minLength={4}
              />
              <span className="muted tiny">
                Enter the transaction reference from your payment app after sending.
              </span>
            </label>

            <div className="sd-manual-plan-label">
              Submitting for: <strong style={{ textTransform: "capitalize" }}>{selected?.name}</strong>
              {" "}— PKR {Number(selected?.price).toLocaleString()}
            </div>

            <button className="btn" type="submit" disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <TrendingUp size={15} />
              {busy ? "Submitting…" : "Send for approval"}
            </button>
            <p className="muted tiny">
              Our team reviews submissions within a few hours and activates your plan by email.
            </p>
          </form>
        </Card>
      )}

      <Card title="Payment history" icon={History}>
        {history.length === 0 ? (
          <EmptyState icon={History} title="No payments yet." />
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id}>
                    <td title={p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}>
                      {relTime(p.createdAt)}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{p.plan}</td>
                    <td>PKR {Number(p.amount).toLocaleString()}</td>
                    <td>{p.method}</td>
                    <td>
                      <Badge tone={p.status === "approved" ? "green" : p.status === "rejected" ? "red" : "amber"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td>
                      {p.status === "approved" && (
                        <button
                          type="button"
                          className="sd-icon-btn"
                          title="View receipt"
                          aria-label="View receipt"
                          onClick={() => viewReceipt(p)}
                        >
                          <Receipt size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {checkoutOpen && selected && (
        <DemoCheckout
          plan={selected}
          onClose={handleCheckoutClose}
          onPay={payDemo}
        />
      )}
    </>
  );
}
