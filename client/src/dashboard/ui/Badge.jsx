export default function Badge({ tone = 'gray', children, onClick, as: Tag = 'span' }) {
  return (
    <Tag
      className={`sd-badge ${tone} ${onClick ? 'sd-badge-btn' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Tag>
  )
}
