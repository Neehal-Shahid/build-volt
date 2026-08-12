const PURPOSES = [
  'Office',
  'Studies',
  'Coding',
  'Designing',
  'Video Editing',
  'Gaming',
  'Streaming',
  'Mixed Use',
]

export default function PurposeStrip() {
  const loop = [...PURPOSES, ...PURPOSES]

  return (
    <div className="lp-strip">
      <p className="lp-strip-label">Every build, matched to what it's actually for</p>
      <div className="lp-strip-track" aria-hidden="true">
        <div className="lp-strip-row">
          {loop.map((p, i) => (
            <span className="lp-strip-item" key={`${p}-${i}`}>
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
