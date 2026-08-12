export function Skeleton({ className = '', style }) {
  return <div className={`sd-skel ${className}`} style={style} />
}

export function SkeletonStats({ count = 3 }) {
  return (
    <div className="sd-stats-grid">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="sd-skel-stat" />
      ))}
    </div>
  )
}

export function SkeletonRows({ count = 4 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="sd-skel-row" />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return <Skeleton className="sd-skel-card" />
}
