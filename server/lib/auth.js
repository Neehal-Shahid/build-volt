import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb } from '../database.js'

const JWT_SECRET = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

export function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  if (!/[A-Z]/.test(password)) return 'Password needs an uppercase letter'
  if (!/[a-z]/.test(password)) return 'Password needs a lowercase letter'
  if (!/[0-9]/.test(password)) return 'Password needs a number'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password needs a special character'
  return null
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')
}

export function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

export function tempStoreId() {
  return `temp-${crypto.randomBytes(4).toString('hex')}`
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password, hash) {
  if (!hash) return false
  return bcrypt.compare(password, hash)
}

export function signStoreToken(store) {
  return jwt.sign(
    {
      storeId: store.id,
      email: store.email,
      type: 'store',
    },
    JWT_SECRET(),
    { expiresIn: '7d' }
  )
}

export function verifyStoreToken(token) {
  const payload = jwt.verify(token, JWT_SECRET())
  if (payload.type !== 'store') throw new Error('Invalid token type')
  return payload
}

export function signAdminToken(admin) {
  return jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      type: 'admin',
      isAdmin: true,
    },
    JWT_SECRET(),
    { expiresIn: '1d' }
  )
}

export function verifyAdminToken(token) {
  const payload = jwt.verify(token, JWT_SECRET())
  if (payload.type !== 'admin' || !payload.isAdmin) throw new Error('Invalid token type')
  return payload
}

export function authStore(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      return res.status(401).json({ success: false, error: 'Not logged in' })
    }
    req.user = verifyStoreToken(token)
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' })
  }
}

export function authAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      return res.status(401).json({ success: false, error: 'Not logged in' })
    }
    req.admin = verifyAdminToken(token)
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Admin session expired. Please log in again.' })
  }
}

export async function getAdminByEmail(email) {
  const result = await getDb().execute({
    sql: 'SELECT * FROM admins WHERE email = ? LIMIT 1',
    args: [email.toLowerCase()],
  })
  return result.rows[0] || null
}

export async function getAdminById(id) {
  const result = await getDb().execute({
    sql: 'SELECT * FROM admins WHERE id = ? LIMIT 1',
    args: [id],
  })
  return result.rows[0] || null
}

export function publicAdmin(admin) {
  if (!admin) return null
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name || 'Admin',
  }
}

export async function getStoreById(id) {
  const result = await getDb().execute({
    sql: 'SELECT * FROM stores WHERE id = ? LIMIT 1',
    args: [id],
  })
  return result.rows[0] || null
}

export async function getStoreByEmail(email) {
  const result = await getDb().execute({
    sql: 'SELECT * FROM stores WHERE email = ? LIMIT 1',
    args: [email.toLowerCase()],
  })
  return result.rows[0] || null
}

export function publicStore(store) {
  if (!store) return null
  return {
    id: store.id,
    email: store.email,
    name: store.name || '',
    plan: store.plan,
    planEnds: store.plan_ends,
    trialStartedAt: store.trial_started_at,
    trialEnds: store.trial_ends,
    active: !!store.active,
    disabled: !!store.disabled,
    emailVerified: !!store.email_verified,
    widgetEnabled: !!store.widget_enabled,
    brandColor: store.brand_color,
    currency: store.currency,
    widgetTitle: store.widget_title,
    welcomeMsg: store.welcome_msg,
    buttonText: store.button_text,
    widgetBg: store.widget_bg,
    budgetPresets: (() => {
      try {
        const parsed = JSON.parse(store.budget_presets || '[]')
        return Array.isArray(parsed) ? parsed : [50000, 80000, 120000, 200000]
      } catch {
        return [50000, 80000, 120000, 200000]
      }
    })(),
    wooConnected: !!store.woo_connected,
    wooLastSync: store.woo_last_sync || null,
    widgetLastSeen: store.widget_last_seen || null,
    widgetInstalledAt: store.widget_installed_at || null,
    marketingOptIn: !!store.marketing_opt_in,
    needsSetup: String(store.id || '').startsWith('temp-'),
    trialExpired: (() => {
      if (store.plan !== 'trial' || !store.trial_ends) return false
      return new Date(store.trial_ends).getTime() < Date.now()
    })(),
    planExpired: (() => {
      if (store.plan === 'trial' || !store.plan_ends) return false
      return new Date(store.plan_ends).getTime() < Date.now()
    })(),
    widgetInstalled: (() => {
      if (store.woo_connected || store.widget_installed_at) return true
      if (!store.widget_last_seen) return false
      const age = Date.now() - new Date(store.widget_last_seen).getTime()
      return Number.isFinite(age) && age < 30 * 24 * 60 * 60 * 1000
    })(),
  }
}

export async function cleanupOldPending() {
  await getDb().execute({
    sql: `DELETE FROM pending_signups WHERE created_at < datetime('now', '-7 days')`,
  })
  await getDb().execute({
    sql: `DELETE FROM tokens WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`,
  })
}
