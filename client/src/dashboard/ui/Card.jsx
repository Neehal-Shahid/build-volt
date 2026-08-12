export default function Card({ title, icon: Icon, children, style }) {
  return (
    <section className="sd-card" style={style}>
      {title && (
        <h3 className="sd-card-title">
          {Icon && <Icon size={17} strokeWidth={2.25} />}
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}
