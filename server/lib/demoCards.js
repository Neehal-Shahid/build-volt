/** Demo card catalog — for FYP simulation only (not real charges). */

export const DEMO_TEST_CARDS = [
  {
    number: '4242424242424242',
    brand: 'Visa',
    result: 'success',
    label: 'Success',
    hint: 'Any future expiry · any 3-digit CVC',
  },
  {
    number: '5555555555554444',
    brand: 'Mastercard',
    result: 'success',
    label: 'Success',
    hint: 'Any future expiry · any 3-digit CVC',
  },
  {
    number: '378282246310005',
    brand: 'American Express',
    result: 'success',
    label: 'Success (Amex)',
    hint: 'Any future expiry · any 4-digit CID',
  },
  {
    number: '4000000000000002',
    brand: 'Visa',
    result: 'declined',
    label: 'Card declined',
    hint: 'Simulates bank decline',
  },
  {
    number: '4000000000009995',
    brand: 'Visa',
    result: 'insufficient_funds',
    label: 'Insufficient funds',
    hint: 'Simulates NSF',
  },
  {
    number: '4000000000000069',
    brand: 'Visa',
    result: 'expired',
    label: 'Expired card',
    hint: 'Simulates expired card',
  },
  {
    number: '4000000000000119',
    brand: 'Visa',
    result: 'processing_error',
    label: 'Processing error',
    hint: 'Simulates gateway error — retry',
  },
]

export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

export function luhnOk(num) {
  const s = digitsOnly(num)
  if (s.length < 13) return false
  let sum = 0
  let alt = false
  for (let i = s.length - 1; i >= 0; i--) {
    let n = parseInt(s[i], 10)
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

export function detectBrand(num) {
  const s = digitsOnly(num)
  if (/^3[47]/.test(s)) return 'American Express'
  if (/^5[1-5]/.test(s) || /^2(2[2-9]|[3-6]|7[01])/.test(s)) return 'Mastercard'
  if (/^4/.test(s)) return 'Visa'
  return 'Card'
}

export function formatCardNumber(num) {
  const s = digitsOnly(num)
  if (detectBrand(s) === 'American Express') {
    return s.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' ')
    )
  }
  return s.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

export function findDemoCard(num) {
  const s = digitsOnly(num)
  return DEMO_TEST_CARDS.find((c) => c.number === s) || null
}

export function parseExpiry(exp) {
  const raw = String(exp || '').trim()
  const m = raw.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/)
  if (!m) return null
  let month = Number(m[1])
  let year = Number(m[2])
  if (year < 100) year += 2000
  if (month < 1 || month > 12) return null
  return { month, year }
}

export function expiryValid(exp) {
  const p = parseExpiry(exp)
  if (!p) return false
  const now = new Date()
  const end = new Date(p.year, p.month, 0, 23, 59, 59)
  return end >= now
}

export function cvcValid(cvc, brand) {
  const s = digitsOnly(cvc)
  if (brand === 'American Express') return s.length === 4
  return s.length === 3
}

/**
 * Validate demo checkout fields. Returns { ok, error, card, brand }.
 */
export function validateDemoPayment({ number, expiry, cvc, name }) {
  const brand = detectBrand(number)
  const s = digitsOnly(number)
  if (!String(name || '').trim() || String(name).trim().length < 2) {
    return { ok: false, error: 'Enter the name on the card' }
  }
  if (!luhnOk(s)) {
    return { ok: false, error: 'Card number looks invalid' }
  }
  if (!expiryValid(expiry)) {
    return { ok: false, error: 'Enter a valid future expiry (MM/YY)' }
  }
  if (!cvcValid(cvc, brand)) {
    return {
      ok: false,
      error: brand === 'American Express' ? 'Enter a 4-digit CID' : 'Enter a 3-digit CVC',
    }
  }

  const card = findDemoCard(s)
  if (!card) {
    return {
      ok: false,
      error:
        'Use a BuildBot demo test card (see the list on the checkout). Random cards are not accepted in demo mode.',
    }
  }

  if (card.result === 'expired') {
    return { ok: false, error: 'Your card has expired.', code: 'expired', card, brand }
  }
  if (card.result === 'declined') {
    return { ok: false, error: 'Your card was declined.', code: 'declined', card, brand }
  }
  if (card.result === 'insufficient_funds') {
    return {
      ok: false,
      error: 'Insufficient funds on this card.',
      code: 'insufficient_funds',
      card,
      brand,
    }
  }
  if (card.result === 'processing_error') {
    return {
      ok: false,
      error: 'A processing error occurred. Please try again.',
      code: 'processing_error',
      card,
      brand,
    }
  }

  return { ok: true, card, brand, last4: s.slice(-4) }
}
