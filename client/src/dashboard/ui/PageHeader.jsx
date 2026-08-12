export default function PageHeader({ title, description, actions }) {
  return (
    <div className="sd-page-header">
      <div>
        <h1 className="sd-page-title">{title}</h1>
        {description && <p className="sd-page-desc">{description}</p>}
      </div>
      {actions && <div className="sd-page-actions">{actions}</div>}
    </div>
  )
}
