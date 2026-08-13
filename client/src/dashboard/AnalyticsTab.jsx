import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Wallet, Target, History, Calendar, Gauge } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getWidgetStatus, isPlanLapsed } from "../lib/widgetStatus";
import PageHeader from "./ui/PageHeader";
import Card from "./ui/Card";
import StatCard from "./ui/StatCard";
import EmptyState from "./ui/EmptyState";
import { SkeletonStats, SkeletonCard } from "./ui/Skeleton";
import Alert from "./ui/Alert";
import Badge from "./ui/Badge";

function formatDay(dateStr) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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

export default function AnalyticsTab({ store, onGoTab, mode }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const hideEmbed = mode === "woo" || !!store?.wooConnected;
  const widgetStatus = getWidgetStatus(store);
  const planLapsed = isPlanLapsed(store);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api("/api/analytics", { token });
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <>
        <PageHeader title="Analytics" description="Recommendation activity for your store." />
        <SkeletonStats />
        <SkeletonCard />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Analytics" description="Recommendation activity for your store." />
        <Alert type="error">{error}</Alert>
      </>
    );
  }

  const maxDaily = Math.max(1, ...(data.dailyActivity || []).map((d) => d.count));

  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = (data.dailyActivity || [])
    .filter((d) => d.day && d.day.startsWith(thisMonthStr))
    .reduce((s, d) => s + (d.count || 0), 0);

  const hasData = data.totalRecommendations > 0;
  const usage = data.usage;
  const usagePct = usage?.limit
    ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
    : 0;

  function goInstall() {
    if (!onGoTab) return;
    onGoTab(hideEmbed ? "store" : "embed");
  }

  return (
    <>
      <PageHeader title="Analytics" description="Recommendation activity for your store." />

      {planLapsed && (
        <div className="sd-banner warn">
          <p style={{ margin: 0 }}>
            Your plan has expired — the widget is paused and new recommendations are blocked.
            Upgrade from Billing to restore service.
          </p>
          {onGoTab && (
            <button type="button" className="btn" onClick={() => onGoTab("billing")}>
              View plans
            </button>
          )}
        </div>
      )}

      <div className="sd-stats-grid">
        <StatCard icon={BarChart3} tone="blue" label="Total recommendations" value={data.totalRecommendations} />
        <StatCard icon={Calendar} tone="purple" label="This month" value={thisMonth} />
        <StatCard
          icon={Wallet}
          tone="green"
          label="Avg budget"
          value={data.avgBudget ? `PKR ${Number(data.avgBudget).toLocaleString()}` : "—"}
        />
        <StatCard icon={Target} tone="amber" label="Purposes tracked" value={(data.byPurpose || []).length} />
      </div>

      {usage && (
        <Card title="Usage this period" icon={Gauge}>
          <div className="sd-usage-meter">
            <div className="sd-usage-header">
              <span>
                <strong>{usage.used}</strong>
                <span className="muted"> / {usage.limit} recommendations per {usage.period}</span>
              </span>
              <Badge tone={usage.remaining === 0 ? "red" : usagePct >= 80 ? "amber" : "green"}>
                {usage.remaining} left
              </Badge>
            </div>
            <div className="sd-plan-progress-track" style={{ marginTop: "0.5rem" }}>
              <div
                className="sd-plan-progress-fill"
                style={{
                  width: `${usagePct}%`,
                  background: usage.remaining === 0 ? "#ef4444" : usagePct >= 80 ? "#f59e0b" : undefined,
                }}
              />
            </div>
            {usage.remaining === 0 && (
              <p className="muted tiny" style={{ margin: "0.5rem 0 0" }}>
                Limit reached for this {usage.period}. {store?.plan === "trial" ? "Upgrade for higher limits." : "Resets automatically next period."}
              </p>
            )}
          </div>
        </Card>
      )}

      {!hasData ? (
        <Card title="No data yet">
          <EmptyState
            icon={BarChart3}
            title="No recommendations yet"
            description={
              widgetStatus === "active"
                ? "Share your store — shopper recommendations will appear here."
                : widgetStatus === "paused"
                ? "Your widget is paused. Upgrade your plan to start collecting data again."
                : "Install and enable your widget to start collecting recommendation data."
            }
          />
          {onGoTab && widgetStatus !== "paused" && (
            <button type="button" className="btn" style={{ marginTop: "0.75rem" }} onClick={goInstall}>
              {hideEmbed ? "Set up WooCommerce →" : "Go to Install Widget →"}
            </button>
          )}
        </Card>
      ) : (
        <>
          <Card title="By purpose" icon={TrendingUp}>
            {(data.byPurpose || []).length === 0 ? (
              <EmptyState icon={TrendingUp} title="No purpose data yet." />
            ) : (
              <>
                <div className="bars">
                  {(() => {
                    const maxPurpose = Math.max(1, ...data.byPurpose.map(r => r.count))
                    return data.byPurpose.map((row) => (
                      <div className="bar-row" key={row.purpose}>
                        <span className="bar-label" style={{ minWidth: 100 }}>{row.purpose}</span>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${(row.count / maxPurpose) * 100}%`, background: 'var(--blue)' }}
                          />
                        </div>
                        <span className="bar-count">{row.count}</span>
                      </div>
                    ))
                  })()}
                </div>
                <p className="muted tiny" style={{ margin: '0.75rem 0 0' }}>
                  Total: <strong>{data.byPurpose.reduce((s, r) => s + r.count, 0)}</strong> recommendations across {data.byPurpose.length} purpose{data.byPurpose.length !== 1 ? 's' : ''}
                </p>
              </>
            )}
          </Card>

          <Card title="Daily activity — last 14 days" icon={BarChart3}>
            {(data.dailyActivity || []).length === 0 ? (
              <EmptyState icon={BarChart3} title="No recent activity yet." />
            ) : (
              <>
                <p className="muted tiny" style={{ margin: '0 0 0.75rem' }}>
                  Peak: <strong>{maxDaily}</strong> recommendation{maxDaily !== 1 ? 's' : ''} in a day
                </p>
                <div className="bars">
                  {data.dailyActivity.map((d) => (
                    <div className="bar-row" key={d.day}>
                      <span className="bar-label">{formatDay(d.day)}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${(d.count / maxDaily) * 100}%` }}
                          title={`${d.count} recommendation${d.count !== 1 ? 's' : ''}`}
                        />
                      </div>
                      <span className="bar-count">{d.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {data.recent && data.recent.length > 0 && (() => {
            const buckets = [
              { label: 'Under 50k',   count: data.recent.filter(r => r.budget < 50000).length },
              { label: '50k – 100k', count: data.recent.filter(r => r.budget >= 50000 && r.budget <= 100000).length },
              { label: '100k – 200k', count: data.recent.filter(r => r.budget > 100000 && r.budget <= 200000).length },
              { label: 'Over 200k',  count: data.recent.filter(r => r.budget > 200000).length },
            ].filter(b => b.count > 0)
            if (!buckets.length) return null
            return (
              <Card title="Budget distribution (recent)" icon={Wallet}>
                <div className="bars">
                  {(() => {
                    const maxB = Math.max(1, ...buckets.map(b => b.count))
                    return buckets.map(b => (
                      <div className="bar-row" key={b.label}>
                        <span className="bar-label" style={{ minWidth: 100 }}>{b.label}</span>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${(b.count / maxB) * 100}%`, background: '#10b981' }} />
                        </div>
                        <span className="bar-count">{b.count}</span>
                      </div>
                    ))
                  })()}
                </div>
              </Card>
            )
          })()}

          <Card title="Recent recommendations" icon={History}>
            {(data.recent || []).length === 0 ? (
              <EmptyState icon={History} title="None yet." />
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
                    {data.recent.map((r) => (
                      <tr key={r.id}>
                        <td title={r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}>
                          {relTime(r.createdAt)}
                        </td>
                        <td>{r.purpose || "—"}</td>
                        <td>{r.budget ? `PKR ${Number(r.budget).toLocaleString()}` : "—"}</td>
                        <td>
                          <Badge tone={r.source === "cached" ? "gray" : "blue"}>{r.source}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
