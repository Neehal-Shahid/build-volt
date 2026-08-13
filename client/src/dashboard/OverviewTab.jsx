import { useEffect, useState } from "react";
import {
  Zap, Clock, ArrowRight,
  CheckCircle2, History, Package, Palette, Code2,
  CreditCard, TrendingUp, Users
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getCatalogMode } from "../lib/catalogMode";
import { getWidgetStatus, isWidgetInstalled, isWidgetEnabled, isPlanLapsed, WIDGET_STATUS_LABELS, widgetStatusTone, widgetPauseHint } from "../lib/widgetStatus";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";
import StatCard from "./ui/StatCard";
import EmptyState from "./ui/EmptyState";
import { SkeletonRows } from "./ui/Skeleton";
import Badge from "./ui/Badge";

function relTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  if (m >= 1) return `${m}m ago`;
  return "just now";
}

export default function OverviewTab({ store, onGoTab }) {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [productCount, setProductCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [widgetStatus, setWidgetStatus] = useState(() => getWidgetStatus(store));

  useEffect(() => {
    setWidgetStatus(getWidgetStatus(store));
  }, [store]);

  useEffect(() => {
    function syncInstallStatus() {
      setWidgetStatus(getWidgetStatus(store));
    }
    window.addEventListener("storage", syncInstallStatus);
    window.addEventListener("bb-widget-live-change", syncInstallStatus);
    return () => {
      window.removeEventListener("storage", syncInstallStatus);
      window.removeEventListener("bb-widget-live-change", syncInstallStatus);
    };
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [analyticsRes, productsRes] = await Promise.all([
          api("/api/analytics", { token }),
          store?.id
            ? api(`/api/products/manage/${encodeURIComponent(store.id)}`, { token })
            : Promise.resolve({ products: [] }),
        ]);
        if (!cancelled) {
          setAnalytics(analyticsRes);
          setProductCount((productsRes.products || []).length);
        }
      } catch {
        if (!cancelled) {
          setAnalytics({ totalRecommendations: 0, recent: [] });
          setProductCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, store?.id]);

  const isTrial = store?.plan === "trial";
  const trialDays = store?.trialEnds
    ? Math.max(0, Math.ceil((new Date(store.trialEnds) - Date.now()) / 86400000))
    : null;

  const planEnds = store?.planEnds;
  const planDaysLeft = planEnds
    ? Math.max(0, Math.ceil((new Date(planEnds) - Date.now()) / 86400000))
    : null;

  const weekRecs = (analytics?.dailyActivity || [])
    .slice(0, 7)
    .reduce((sum, d) => sum + (d.count || 0), 0);

  const recent = (analytics?.recent || []).slice(0, 5);
  const hasProducts = (productCount ?? 0) > 0;
  const wooConnected = !!store?.wooConnected;
  const hideEmbed = getCatalogMode() === "woo" || wooConnected;
  const widgetInstalled = isWidgetInstalled(store);
  const widgetEnabled = isWidgetEnabled(store);

  // Essential setup steps only — each condition is verified from live data
  const steps = [
    {
      label: "Name your store",
      done: !store?.needsSetup,
      goTo: "store",
    },
    {
      label: "Add products to your catalog",
      done: hasProducts,
      goTo: "products",
    },
    {
      label: wooConnected
        ? "Connect WooCommerce plugin"
        : "Install widget on your site",
      done: widgetInstalled,
      goTo: hideEmbed ? "store" : "embed",
    },
    {
      label: "Enable widget for shoppers",
      done: widgetEnabled && widgetInstalled,
      goTo: "settings",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  const statusTone = widgetStatusTone(widgetStatus);
  const planLapsed = isPlanLapsed(store);
  const pauseHint = widgetPauseHint(store);

  const quickActions = [
    { label: "Widget Settings", icon: Palette, tab: "settings", desc: "Customize colors & text" },
    ...(hideEmbed
      ? []
      : [{ label: "Go Live", icon: Code2, tab: "embed", desc: "Install on your site" }]),
    { label: "View Plans", icon: CreditCard, tab: "billing", desc: "Upgrade or renew" },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back${store?.name ? `, ${store.name}` : ""}`}
        description="Here's what's happening with your store today."
      />

      {planLapsed && (
        <div className="sd-banner warn">
          <div className="sd-banner-copy">
            <Clock size={20} strokeWidth={2} />
            <p>
              {pauseHint || "Your plan has expired."}{" "}
              Your widget is paused for shoppers until you upgrade.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => onGoTab("billing")}>
            Upgrade now
          </button>
        </div>
      )}

      {isTrial && !planLapsed && trialDays !== null && (
        <div className={`sd-banner ${trialDays <= 3 ? "warn" : ""}`}>
          <div className="sd-banner-copy">
            <Clock size={20} strokeWidth={2} />
            <p>
              {trialDays > 0
                ? `Your trial ends in ${trialDays} day${trialDays === 1 ? "" : "s"}.`
                : "Your trial has ended."}{" "}
              Upgrade to keep your widget running without interruption.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => onGoTab("billing")}>
            View plans
          </button>
        </div>
      )}

      <div className="sd-stats-grid">
        <StatCard
          icon={TrendingUp}
          tone="blue"
          label="Total Recommendations"
          value={loading ? "…" : analytics?.totalRecommendations ?? 0}
        />
        <StatCard
          icon={History}
          tone="purple"
          label="This Week"
          value={loading ? "…" : weekRecs}
        />
        <StatCard
          icon={Zap}
          tone={statusTone}
          label="Widget Status"
          value={WIDGET_STATUS_LABELS[widgetStatus]}
        />
        <StatCard
          icon={CreditCard}
          tone={isTrial ? "amber" : "green"}
          label="Plan"
          value={
            isTrial
              ? `Trial · ${trialDays ?? "?"}d left`
              : planDaysLeft !== null
              ? `${store?.plan} · ${planDaysLeft}d left`
              : store?.plan || "—"
          }
        />
      </div>

      {!allDone && (
        <Card title={`Get started (${completedCount}/${steps.length})`}>
          <p className="muted tiny" style={{ margin: "0 0 0.85rem" }}>
            Complete these steps to start receiving shopper recommendations.
          </p>
          <div className="sd-checklist-progress">
            <div
              className="sd-checklist-bar"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
          <div className="sd-steps" style={{ marginTop: "1rem" }}>
            {steps.map((step) => (
              <button
                key={step.label}
                type="button"
                className={`sd-step-item${step.done ? " done" : ""}${step.goTo && !step.done ? " actionable" : ""}`}
                onClick={() => step.goTo && !step.done && onGoTab(step.goTo)}
                style={{ cursor: step.goTo && !step.done ? "pointer" : "default" }}
              >
                <span className={`sd-step-check ${step.done ? "done" : ""}`}>
                  <CheckCircle2 size={14} strokeWidth={3} />
                </span>
                <span className={`sd-step-label ${step.done ? "done" : ""}`}>{step.label}</span>
                {step.goTo && !step.done && <ArrowRight size={15} className="sd-step-arrow" />}
              </button>
            ))}
          </div>
        </Card>
      )}

      {!loading && analytics?.totalRecommendations === 0 && (
        <Card title="How BuildBot works">
          <div className="sd-how-grid">
            {[
              { icon: Package, label: "1. Add products", desc: "Upload your catalog manually or sync from WooCommerce." },
              { icon: Palette, label: "2. Customize widget", desc: "Set your brand color, welcome message, and CTA text." },
              { icon: Code2, label: "3. Install on your site", desc: "Paste one script tag before </body> — takes 30 seconds." },
              { icon: Users, label: "4. Get recommendations", desc: "Shoppers answer 3 questions and get AI-powered product picks." },
            ].map((s) => (
              <div key={s.label} className="sd-how-step">
                <span className="sd-how-icon"><s.icon size={20} strokeWidth={1.75} /></span>
                <strong>{s.label}</strong>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="sd-quick-actions">
        {quickActions.map((a) => (
          <button
            key={a.tab}
            type="button"
            className="sd-quick-action-btn"
            onClick={() => onGoTab(a.tab)}
          >
            <span className="sd-quick-action-icon"><a.icon size={18} strokeWidth={1.75} /></span>
            <div>
              <div className="sd-quick-action-label">{a.label}</div>
              <div className="sd-quick-action-desc">{a.desc}</div>
            </div>
            <ArrowRight size={15} style={{ marginLeft: "auto", color: "var(--muted)" }} />
          </button>
        ))}
      </div>

      <Card title="Recent activity" icon={History}>
        {loading ? (
          <SkeletonRows count={3} />
        ) : !recent.length ? (
          <EmptyState
            icon={History}
            title="No shopper activity yet"
            description={
              widgetStatus === "active"
                ? "Share your store link — recommendations will appear here."
                : "Install and enable your widget to start collecting recommendations."
            }
          />
        ) : (
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Purpose</th>
                  <th>Budget</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td title={r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}>
                      {relTime(r.createdAt)}
                    </td>
                    <td>{r.purpose || "—"}</td>
                    <td>{r.budget ? `PKR ${Number(r.budget).toLocaleString()}` : "—"}</td>
                    <td>
                      <Badge tone={r.canBuild ? "green" : "amber"}>{r.source}</Badge>
                    </td>
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
