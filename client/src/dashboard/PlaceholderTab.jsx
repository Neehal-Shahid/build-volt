export function PlaceholderTab({ title, note }) {
  return (
    <section className="dash-panel">
      <h2>{title}</h2>
      <p className="muted">{note}</p>
      <div className="shell-box">Coming in a later phase — shell only for now.</div>
    </section>
  )
}
