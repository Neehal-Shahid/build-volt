import { useEffect, useState } from "react";
import {
  CreditCard, Landmark, History, Shield, CheckCircle,
  Clock, TrendingUp, Zap, Smartphone, Banknote
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

export default function BillingTab({ store, onGoTab }) {
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

  async function load() {
    setLoading(true);
    setError("");
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

  async function submitManual(e) {
    e.preventDefault();
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
      await load();
    } catch (err) {
      setError(err.message || "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  // BUGFIX: Do NOT call load() inside payDemo — it resets loading state and
  // destroys the DemoCheckout component while it's still showing success.
  // Instead, return the result; the checkout will close itself, and THEN we reload.
  async function payDemo(payload) {
    const res = await api("/api/payment/demo-checkout", {
      method: "POST", token, body: payload,
    });
    if (res.token && res.store) persistSession(res.token, res.store);
    return res;
  }

  // Called by DemoCheckout onClose after success — reload billing data then
  function handleCheckoutClose() {
    setCheckoutOpen(false);
    load();
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

  return (
    <>
      <PageHeader title="Billing" description="Manage your plan and payment history." />

      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      {/* Current plan status card */}
      <Card>
        <div className="sd-current-plan-card">
          <div className="sd-current-plan-left">
            <div className="sd-current-plan-eyebrow">Current plan</div>
            <div className="sd-current-plan-name">
              {current?.plan || store?.plan || "Trial"}
              <Badge
                tone={isTrial ? "amber" : "green"}
                style={{ marginLeft: "0.5rem", textTransform: "capitalize" }}
              >
                {isTrial ? "Trial" : "Active"}
              </Badge>
            </div>
            {isTrial && trialDays !== null && (
              <p className="muted tiny" style={{ margin: "0.3rem 0 0" }}>
                <Clock size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
                Trial ends in {trialDays} day{trialDays === 1 ? "" : "s"}
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

      {/* Plan picker */}
      <div className="plan-grid">
        {plans.map((p) => {
          const features = PLAN_FEATURES[p.id] || [];
          return (
            <button
              key={p.id}
              type="button"
              className={`plan-card ${selectedPlan === p.id ? "active" : ""}`}
              onClick={() => setSelectedPlan(p.id)}
            >
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

      {/* Card payment */}
      {demoEnabled && selected && (
        <Card title="Pay with Card" icon={CreditCard}>
          <div className="sd-pay-trust">
            <span><Shield size={13} /> Secure checkout</span>
            <span><Zap size={13} /> Instant activation</span>
            <span>✓ 30-day access</span>
          </div>
          <p className="muted" style={{ margin: "0.75rem 0" }}>
            Complete your payment securely. Your plan activates immediately upon successful payment.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setCheckoutOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 800 }}
          >
            <CreditCard size={16} />
            Pay PKR {Number(selected?.price).toLocaleString()} →
          </button>
        </Card>
      )}

      {/* JazzCash / EasyPaisa */}
      {jazzcashEnabled && (
        <Card title="Bank Transfer" icon={Landmark}>
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
            {/* Method pill selector */}
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
              {busy ? "Submitting…" : "Send for approval →"}
            </button>
            <p className="muted tiny">
              Our team reviews submissions within a few hours and activates your plan by email.
            </p>
          </form>
        </Card>
      )}

      {/* Payment history */}
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
