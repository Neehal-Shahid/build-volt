import { Loader2 } from 'lucide-react'

export default function SubmitButton({ busy, children, busyLabel, className = 'btn', ...rest }) {
  return (
    <button className={`${className} auth-submit`} type="submit" disabled={busy} {...rest}>
      {busy && <Loader2 size={17} className="auth-spinner" />}
      {busy ? busyLabel || children : children}
    </button>
  )
}
