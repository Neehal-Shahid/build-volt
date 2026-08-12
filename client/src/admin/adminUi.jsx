import { CheckCircle, AlertCircle, Info } from 'lucide-react'

const ICONS = {
  success: <CheckCircle size={16} strokeWidth={2.5} />,
  error:   <AlertCircle size={16} strokeWidth={2.5} />,
  info:    <Info        size={16} strokeWidth={2.5} />,
}

/**
 * Renders the floating toast area.
 * Pass the `toasts` array from useToast().
 */
export function ToastArea({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="ad-toast-area">
      {toasts.map((t) => (
        <div key={t.id} className={`ad-toast ${t.type}`}>
          {ICONS[t.type] || ICONS.info}
          {t.message}
        </div>
      ))}
    </div>
  )
}

/**
 * Returns a human-readable relative time string.
 * e.g. "3 minutes ago", "2 days ago"
 */
export function relTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff)) return '—'
  const s  = Math.floor(diff / 1000)
  const m  = Math.floor(s  / 60)
  const h  = Math.floor(m  / 60)
  const d  = Math.floor(h  / 24)
  if (d  >= 1)  return `${d}d ago`
  if (h  >= 1)  return `${h}h ago`
  if (m  >= 1)  return `${m}m ago`
  if (s  >= 5)  return `${s}s ago`
  return 'just now'
}
