import { useEffect, useState } from "react";
import {
  Zap, Clock, ArrowRight,
  CheckCircle2, History, Package, Palette, Code2,
  CreditCard, TrendingUp
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getCatalogMode } from "../lib/catalogMode";
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
  const [productCount, setProductCount] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);

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

  // Recent 7-day recs
  const weekRecs = (analytics?.dailyActivity || [])
    .slice(0, 7)
    .reduce((sum, d) => sum + (d.count || 0), 0);

  const recent = (analytics?.recent || []).slice(0, 5);
  // Use live productCount from API, fall back to store.productCount if still loading
  const hasProducts = (productCount ?? store?.productCount ?? 0) > 0;
  const wooConnected = !!store?.wooConnected;
  const catalogModeSet = getCatalogMode() === "woo" || wooConnected || hasProducts;
  const widgetEnabled = store?.widgetEnabled !== false;
  // Brand color is customised if it differs from the server default
  const DEFAULT_BRAND = "#2A5EE8";
  const brandCustomised = !!store?.brandColor && store.brandColor.toLowerCase() !== DEFAULT_BRAND.toLowerCase();

  // Dynamic checklist — all conditions derived from live data
  const steps = [
    { label: "Create account & verify email",               done: true },
    { label: "Name your store",                              done: !store?.needsSetup },
    { label: "Choose catalog mode (Manual or WooCommerce)",  done: catalogModeSet, goTo: "store" },
    { label: "Add at least one product",                     done: hasProducts,     goTo: "products" },
    { label: "Customize your widget appearance",             done: brandCustomised, goTo: "settings" },
    { label: "Install widget & go live",                     done: widgetEnabled,   goTo: "embed" },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  const quickActions = [
    { label: "Widget Settings", icon: Palette, tab: "settings", desc: "Customize colors & text" },
    { label: "Go Live",         icon: Code2,   tab: "embed",    desc: "Install on your site" },
    { label: "View Plans",      icon: CreditCard, tab: "billing", desc: "Upgrade or renew" },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back${store?.name ? `, ${store.name}` : ""}`}
        description="Here's what's happening with your store today."
      />

      {/* Trial / expiry banner */}
      {isTrial && trialDays !== null && (
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

      {/* Stat cards */}
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
          tone={widgetEnabled ? "green" : "amber"}
          label="Widget Status"
          value={widgetEnabled ? "Live" : "Disabled"}
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

      {/* Setup checklist */}
      {!allDone && (
        <Card title={`Setup checklist (${completedCount}/${steps.length})`}>
          {/* Progress bar */}
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

      {/* No recs yet → how it works */}
      {!loading && analytics?.totalRecommendations === 0 && (
        <Card title="How BuildBot works">
          <div className="sd-how-grid">
            {[
              { icon: Package, label: "1. Add products",  desc: "Upload your catalog manually or sync from WooCommerce." },
              { icon: Palette, label: "2. Customize widget", desc: "Set your brand colors, welcome message, and CTA text." },
              { icon: Code2,   label: "3. Install on your site", desc: "Paste one script tag before </body> — takes 30 seconds." },
              { icon: Users,   label: "4. Get recommendations", desc: "Shoppers answer 3 questions and get AI-powered product picks." },
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

      {/* Quick actions */}
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

      {/* Recent activity */}
      <Card title="Recent activity" icon={History}>
        {loading ? (
          <SkeletonRows count={3} />
        ) : !recent.length ? (
          <EmptyState
            icon={History}
            title="No shopper activity yet"
            description="Install your widget to start collecting recommendations."
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
