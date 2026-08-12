import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Wallet, Target, History, Calendar } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
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

export default function AnalyticsTab({ onGoTab }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  // This month count
  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = (data.dailyActivity || [])
    .filter((d) => d.day && d.day.startsWith(thisMonthStr))
    .reduce((s, d) => s + (d.count || 0), 0);

  const hasData = data.totalRecommendations > 0;

  return (
    <>
      <PageHeader title="Analytics" description="Recommendation activity for your store." />

      <div className="sd-stats-grid">
        <StatCard icon={BarChart3}   tone="blue"   label="Total recommendations" value={data.totalRecommendations} />
        <StatCard icon={Calendar}    tone="purple"  label="This month"           value={thisMonth} />
        <StatCard
          icon={Wallet}
          tone="green"
          label="Avg budget"
          value={data.avgBudget ? `PKR ${Number(data.avgBudget).toLocaleString()}` : "—"}
        />
        <StatCard icon={Target} tone="amber" label="Purposes tracked" value={(data.byPurpose || []).length} />
      </div>

      {!hasData ? (
        <Card title="No data yet">
          <EmptyState
            icon={BarChart3}
            title="No recommendations yet"
            description="Install your widget and start getting shoppers to see analytics here."
          />
          {onGoTab && (
            <button
              type="button"
              className="btn"
              style={{ marginTop: "0.75rem" }}
              onClick={() => onGoTab("embed")}
            >
              Go to Install Widget →
            </button>
          )}
        </Card>
      ) : (
        <>
          <Card title="By purpose" icon={TrendingUp}>
            {(data.byPurpose || []).length === 0 ? (
              <EmptyState icon={TrendingUp} title="No purpose data yet." />
            ) : (
              <div className="sd-steps">
                {data.byPurpose.map((row) => (
                  <div key={row.purpose} className="sd-step-item" style={{ cursor: "default" }}>
                    <span className="sd-step-label" style={{ fontWeight: 700 }}>{row.purpose}</span>
                    <Badge tone="blue">{row.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Daily activity (14 days)" icon={BarChart3}>
            {(data.dailyActivity || []).length === 0 ? (
              <EmptyState icon={BarChart3} title="No recent activity yet." />
            ) : (
              <div className="bars">
                {data.dailyActivity.map((d) => (
                  <div className="bar-row" key={d.day}>
                    <span className="bar-label">{formatDay(d.day)}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(d.count / maxDaily) * 100}%` }} />
                    </div>
                    <span className="bar-count">{d.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

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
                        <td>{r.source}</td>
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
