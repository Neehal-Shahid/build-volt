import { Router } from 'express'
import { getDb, getPlatformConfig } from '../database.js'
import {
  validatePassword,
  isValidEmail,
  randomOtp,
  randomToken,
  tempStoreId,
  hashPassword,
  comparePassword,
  signStoreToken,
  authStore,
  getStoreById,
  getStoreByEmail,
  publicStore,
} from '../lib/auth.js'
import {
  sendEmail,
  verificationEmailContent,
  welcomeEmailContent,
  passwordResetEmailContent,
} from '../email.js'

const router = Router()
const appUrl = () => process.env.APP_URL || 'http://localhost:5173'
// A configured real provider always wins — never echo OTPs/tokens in the API
// response once Resend is live, even if EMAIL_TEST_MODE was left on by mistake.
const emailDevHints = () =>
  process.env.EMAIL_TEST_MODE === 'true' &&
  !(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)

function daysFromNow(days) {
  const d = new Date()
  d.setDate(d.getDate() + Number(days))
  return d.toISOString()
}

async function createVerifiedStoreFromPending(pending) {
  const db = getDb()
  const config = await getPlatformConfig()
  const trialDays = Number(config.trial_days || 14)
  const storeId = tempStoreId()
  const now = new Date().toISOString()
  const trialEnds = daysFromNow(trialDays)

  // widget_enabled starts on (1) so "install the script" is the only real step left —
  // an invisible extra toggle to flip was the biggest source of onboarding confusion.
  await db.execute({
    sql: `INSERT INTO stores (
      id, email, password_hash, name, plan, trial_started_at, trial_ends,
      active, email_verified, marketing_opt_in, tos_accepted_at, widget_enabled, created_at, updated_at
    ) VALUES (?, ?, ?, '', 'trial', ?, ?, 1, 1, ?, ?, 1, ?, ?)`,
    args: [
      storeId,
      pending.email,
      pending.password_hash,
      now,
      trialEnds,
      pending.marketing_opt_in ? 1 : 0,
      pending.tos_accepted_at || now,
      now,
      now,
    ],
  })

  await db.execute({
    sql: 'DELETE FROM pending_signups WHERE id = ?',
    args: [pending.id],
  })

  const welcome = welcomeEmailContent({ email: pending.email, storeId, trialDays })
  await sendEmail({
    to: pending.email,
    subject: welcome.subject,
    text: welcome.text,
    html: welcome.html,
    template: 'welcome',
  })

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `New store verified: ${pending.email}`,
      text: `New store ${storeId} (${pending.email}) just verified.`,
      html: `<p>New store <code>${storeId}</code> — ${pending.email}</p>`,
      template: 'admin_new_store',
    })
  }

  return getStoreById(storeId)
}

// POST /api/signup
router.post('/signup', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const marketingOptIn = req.body.marketingOptIn !== false
    const tosAccepted = req.body.tosAccepted === true

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email' })
    }
    const pwErr = validatePassword(password)
    if (pwErr) return res.status(400).json({ success: false, error: pwErr })
    if (!tosAccepted) {
      return res.status(400).json({ success: false, error: 'You must accept the Terms of Service and Privacy Policy' })
    }

    const existingStore = await getStoreByEmail(email)
    if (existingStore) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists. Please log in.' })
    }

    const db = getDb()
    const otp = randomOtp()
    const verifyToken = randomToken()
    const password_hash = await hashPassword(password)
    const expiresAt = daysFromNow(1)
    const tosAcceptedAt = new Date().toISOString()

    await db.execute({
      sql: `INSERT INTO pending_signups (email, password_hash, otp, verify_token, marketing_opt_in, tos_accepted_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
              password_hash = excluded.password_hash,
              otp = excluded.otp,
              verify_token = excluded.verify_token,
              marketing_opt_in = excluded.marketing_opt_in,
              tos_accepted_at = excluded.tos_accepted_at,
              expires_at = excluded.expires_at,
              created_at = datetime('now')`,
      args: [email, password_hash, otp, verifyToken, marketingOptIn ? 1 : 0, tosAcceptedAt, expiresAt],
    })

    const content = verificationEmailContent({
      appUrl: appUrl(),
      token: verifyToken,
      otp,
    })
    await sendEmail({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      template: 'verify',
    })

    const body = {
      success: true,
      message: 'Check your email for a verification link and 6-digit code.',
      email,
    }
    if (emailDevHints()) {
      body.devHint = { otp, verifyToken, verifyLink: content.link }
    }
    res.json(body)
  } catch (err) {
    console.error('[signup]', err)
    res.status(500).json({ success: false, error: 'Signup failed. Try again.' })
  }
})

// POST /api/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email' })
    }

    const db = getDb()
    const pending = await db.execute({
      sql: 'SELECT * FROM pending_signups WHERE email = ? LIMIT 1',
      args: [email],
    })
    if (!pending.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'No pending signup for this email. Sign up again or log in.',
      })
    }

    const otp = randomOtp()
    const verifyToken = randomToken()
    const expiresAt = daysFromNow(1)
    await db.execute({
      sql: `UPDATE pending_signups SET otp = ?, verify_token = ?, expires_at = ?, created_at = datetime('now')
            WHERE email = ?`,
      args: [otp, verifyToken, expiresAt, email],
    })

    const content = verificationEmailContent({
      appUrl: appUrl(),
      token: verifyToken,
      otp,
    })
    await sendEmail({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      template: 'verify',
    })

    const body = { success: true, message: 'Verification email resent.', email }
    if (emailDevHints()) {
      body.devHint = { otp, verifyToken, verifyLink: content.link }
    }
    res.json(body)
  } catch (err) {
    console.error('[resend-verification]', err)
    res.status(500).json({ success: false, error: 'Could not resend verification.' })
  }
})

// GET /api/verify-email?token=
router.get('/verify-email', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim()
    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing verification token' })
    }

    const db = getDb()
    const result = await db.execute({
      sql: `SELECT * FROM pending_signups
            WHERE verify_token = ?
              AND (expires_at IS NULL OR expires_at >= datetime('now'))
            LIMIT 1`,
      args: [token],
    })
    if (!result.rows.length) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification link' })
    }

    const store = await createVerifiedStoreFromPending(result.rows[0])
    const jwtToken = signStoreToken(store)
    res.json({
      success: true,
      message: 'Email verified. Welcome!',
      token: jwtToken,
      store: publicStore(store),
    })
  } catch (err) {
    console.error('[verify-email]', err)
    res.status(500).json({ success: false, error: 'Verification failed.' })
  }
})

// POST /api/verify-email-otp { email, otp }
router.post('/verify-email-otp', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const otp = String(req.body.otp || '').trim()
    if (!isValidEmail(email) || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' })
    }

    const db = getDb()
    const result = await db.execute({
      sql: `SELECT * FROM pending_signups
            WHERE email = ? AND otp = ?
              AND (expires_at IS NULL OR expires_at >= datetime('now'))
            LIMIT 1`,
      args: [email, otp],
    })
    if (!result.rows.length) {
      return res.status(400).json({ success: false, error: 'Invalid or expired code' })
    }

    const store = await createVerifiedStoreFromPending(result.rows[0])
    const jwtToken = signStoreToken(store)
    res.json({
      success: true,
      message: 'Email verified. Welcome!',
      token: jwtToken,
      store: publicStore(store),
    })
  } catch (err) {
    console.error('[verify-email-otp]', err)
    res.status(500).json({ success: false, error: 'Verification failed.' })
  }
})

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' })
    }

    const store = await getStoreByEmail(email)
    if (!store) {
      const pending = await getDb().execute({
        sql: 'SELECT id FROM pending_signups WHERE email = ? LIMIT 1',
        args: [email],
      })
      if (pending.rows.length) {
        return res.status(403).json({
          success: false,
          error: 'Please verify your email first.',
          needsVerification: true,
          email,
        })
      }
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    const ok = await comparePassword(password, store.password_hash)
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }
    if (!store.email_verified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email first.',
        needsVerification: true,
        email,
      })
    }
    if (store.disabled) {
      return res.status(403).json({ success: false, error: 'This account has been disabled.' })
    }

    const token = signStoreToken(store)
    res.json({
      success: true,
      token,
      store: publicStore(store),
    })
  } catch (err) {
    console.error('[login]', err)
    res.status(500).json({ success: false, error: 'Login failed.' })
  }
})

// POST /api/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email' })
    }

    const store = await getStoreByEmail(email)
    // Always return success to avoid email enumeration
    const generic = {
      success: true,
      message: 'If that email exists, reset instructions were sent.',
    }
    if (!store) return res.json(generic)

    const db = getDb()
    const token = randomToken()
    const otp = randomOtp()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await db.execute({
      sql: `DELETE FROM tokens WHERE email = ? AND type = 'password_reset'`,
      args: [email],
    })
    await db.execute({
      sql: `INSERT INTO tokens (email, token, type, expires_at) VALUES (?, ?, 'password_reset', ?)`,
      args: [email, `${token}:${otp}`, expiresAt],
    })

    const content = passwordResetEmailContent({
      appUrl: appUrl(),
      token,
      otp,
    })
    await sendEmail({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      template: 'password_reset',
    })

    if (emailDevHints()) {
      generic.devHint = { otp, resetToken: token, resetLink: content.link }
    }
    res.json(generic)
  } catch (err) {
    console.error('[forgot-password]', err)
    res.status(500).json({ success: false, error: 'Could not start password reset.' })
  }
})

// POST /api/reset-password { token?, email?, otp?, password }
router.post('/reset-password', async (req, res) => {
  try {
    const password = String(req.body.password || '')
    const token = String(req.body.token || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const otp = String(req.body.otp || '').trim()

    const pwErr = validatePassword(password)
    if (pwErr) return res.status(400).json({ success: false, error: pwErr })

    const db = getDb()
    let row = null

    if (token) {
      // Exact substring match, not LIKE — a caller could otherwise smuggle
      // their own % / _ wildcards into `token` and narrow the search space
      // instead of having to guess the whole random value at once.
      const result = await db.execute({
        sql: `SELECT * FROM tokens
              WHERE type = 'password_reset'
                AND substr(token, 1, ?) = ?
                AND (expires_at IS NULL OR expires_at >= datetime('now'))
              LIMIT 1`,
        args: [token.length, token],
      })
      row = result.rows[0] || null
      if (otp && row) {
        const storedOtp = String(row.token).split(':')[1]
        if (storedOtp !== otp) row = null
      }
    } else if (email && otp) {
      const result = await db.execute({
        sql: `SELECT * FROM tokens
              WHERE type = 'password_reset'
                AND email = ?
                AND substr(token, -?) = ?
                AND (expires_at IS NULL OR expires_at >= datetime('now'))
              LIMIT 1`,
        args: [email, otp.length, otp],
      })
      row = result.rows[0] || null
    } else {
      return res.status(400).json({
        success: false,
        error: 'Provide reset token or email + OTP, plus new password',
      })
    }

    if (!row) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset code' })
    }

    const password_hash = await hashPassword(password)
    await db.execute({
      sql: `UPDATE stores SET password_hash = ?, updated_at = datetime('now') WHERE email = ?`,
      args: [password_hash, row.email],
    })
    await db.execute({
      sql: `DELETE FROM tokens WHERE id = ?`,
      args: [row.id],
    })

    res.json({ success: true, message: 'Password updated. You can log in now.' })
  } catch (err) {
    console.error('[reset-password]', err)
    res.status(500).json({ success: false, error: 'Password reset failed.' })
  }
})

// GET /api/me
router.get('/me', authStore, async (req, res) => {
  try {
    const store = await getStoreById(req.user.storeId)
    if (!store) {
      return res.status(401).json({ success: false, error: 'Store not found' })
    }
    res.json({ success: true, store: publicStore(store) })
  } catch (err) {
    console.error('[me]', err)
    res.status(500).json({ success: false, error: 'Could not load profile' })
  }
})

export default router
