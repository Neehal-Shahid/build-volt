import { Check, X } from 'lucide-react'

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

const LEVELS = [
  { label: 'Very weak', className: 'is-weak' },
  { label: 'Weak', className: 'is-weak' },
  { label: 'Fair', className: 'is-fair' },
  { label: 'Good', className: 'is-good' },
  { label: 'Strong', className: 'is-strong' },
  { label: 'Excellent', className: 'is-strong' },
]

export default function PasswordStrength({ password }) {
  if (!password) return null

  const passed = RULES.filter((rule) => rule.test(password))
  const score = passed.length
  const level = LEVELS[score]

  return (
    <div className="auth-strength">
      <div className="auth-strength-bar">
        {RULES.map((_, i) => (
          <span key={i} className={i < score ? `is-filled ${level.className}` : ''} />
        ))}
      </div>
      <p className={`auth-strength-label ${level.className}`}>{level.label}</p>
      <ul className="auth-strength-rules">
        {RULES.map((rule) => {
          const ok = rule.test(password)
          return (
            <li key={rule.key} className={ok ? 'is-met' : ''}>
              {ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={2.5} />}
              {rule.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
