import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
}

export default function Alert({ type = 'info', children }) {
  if (!children) return null
  const Icon = ICONS[type] || Info

  return (
    <div className={`sd-alert sd-alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={16} strokeWidth={2.25} />
      <span>{children}</span>
    </div>
  )
}
