export default function EmptyState({ icon: Icon, title, action }) {
  return (
    <div className="sd-empty">
      {Icon && (
        <span className="sd-empty-icon">
          <Icon size={24} strokeWidth={1.75} />
        </span>
      )}
      <p>{title}</p>
      {action}
    </div>
  )
}
