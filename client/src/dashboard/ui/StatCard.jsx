export default function StatCard({ icon: Icon, tone = 'blue', label, value, mono, sub }) {
  return (
    <div className="sd-stat-card">
      {Icon && (
        <span className={`sd-stat-icon ${tone}`}>
          <Icon size={20} strokeWidth={2} />
        </span>
      )}
      <div className="sd-stat-body">
        <span className="sd-stat-label">{label}</span>
        <div className={`sd-stat-value ${mono ? 'mono' : ''}`}>{value}</div>
        {sub && <p className="sd-stat-sub">{sub}</p>}
      </div>
    </div>
  )
}
