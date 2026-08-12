export function normalizePaymentMode(raw) {
  const mode = String(raw || 'both').toLowerCase()
  if (mode === 'demo' || mode === 'jazzcash' || mode === 'both') return mode
  return 'both'
}

export function modeFlags(mode) {
  const m = normalizePaymentMode(mode)
  return {
    paymentMode: m,
    demoEnabled: m === 'demo' || m === 'both',
    jazzcashEnabled: m === 'jazzcash' || m === 'both',
  }
}
