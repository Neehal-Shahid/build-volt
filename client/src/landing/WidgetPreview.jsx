import { Cpu, MemoryStick, HardDrive, Fan, Gamepad2 } from 'lucide-react'

const BUILDS = [
  {
    tier: 'Budget Build',
    total: 'Rs 118,500',
    accent: 'var(--muted)',
    parts: [
      { icon: Cpu, label: 'Ryzen 5 5600' },
      { icon: MemoryStick, label: '16GB DDR4' },
    ],
  },
  {
    tier: 'Balanced Build',
    total: 'Rs 172,900',
    accent: 'var(--blue)',
    featured: true,
    parts: [
      { icon: Cpu, label: 'Ryzen 5 7600' },
      { icon: HardDrive, label: 'RTX 4060 8GB' },
    ],
  },
  {
    tier: 'Max Build',
    total: 'Rs 249,000',
    accent: '#0a1a2d',
    parts: [
      { icon: Fan, label: 'Ryzen 7 7800X3D' },
      { icon: Gamepad2, label: 'RTX 4070 Super' },
    ],
  },
]

export default function WidgetPreview({ className = '' }) {
  return (
    <div className={`lp-widget-mock ${className}`.trim()} aria-hidden="true">
      <div className="lp-widget-mock-head">
        <span className="lp-widget-mock-dot" />
        <span>BuildBot</span>
        <span className="lp-widget-mock-close">×</span>
      </div>

      <div className="lp-widget-mock-body">
        <p className="lp-widget-mock-label">What's your budget?</p>
        <div className="lp-widget-mock-chips">
          <span className="lp-chip">Rs 120,000</span>
          <span className="lp-chip lp-chip-active">Rs 200,000</span>
          <span className="lp-chip">Rs 300,000</span>
        </div>

        <p className="lp-widget-mock-label">What's it for?</p>
        <div className="lp-widget-mock-chips">
          <span className="lp-chip">Coding</span>
          <span className="lp-chip lp-chip-active">Gaming</span>
          <span className="lp-chip">Streaming</span>
        </div>

        <div className="lp-widget-mock-results">
          {BUILDS.map((b) => (
            <div
              key={b.tier}
              className={`lp-widget-mock-card ${b.featured ? 'is-featured' : ''}`}
            >
              <div className="lp-widget-mock-card-head">
                <span>{b.tier}</span>
                <strong style={{ color: b.accent }}>{b.total}</strong>
              </div>
              <div className="lp-widget-mock-parts">
                {b.parts.map((p) => (
                  <span key={p.label} className="lp-widget-mock-part">
                    <p.icon size={13} strokeWidth={2.25} />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
